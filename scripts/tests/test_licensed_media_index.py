import copy
import importlib.util
import io
import json
from pathlib import Path
import shutil
import stat
import subprocess
import tempfile
import unittest
import warnings
import wave
import zipfile


SCRIPT = Path(__file__).resolve().parents[1] / "licensed-media-index.py"
spec = importlib.util.spec_from_file_location("licensed_media_index", SCRIPT)
catalog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog)


def wav_bytes():
    output = io.BytesIO()
    with wave.open(output, "wb") as stream:
        stream.setnchannels(1)
        stream.setsampwidth(2)
        stream.setframerate(8000)
        stream.writeframes(b"\x00\x00" * 800)
    return output.getvalue()


class LicensedMediaIndexTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.archive = self.root / "archive.zip"

    def bundle(self, entries):
        with zipfile.ZipFile(self.archive, "w", zipfile.ZIP_DEFLATED) as archive:
            for name, data in entries:
                archive.writestr(name, data)
        return catalog.scan(self.archive, "FourEditors", "User confirmed public platform use")

    def test_inventory_does_not_extract_and_does_not_count_metadata_as_media(self):
        index = self.bundle([
            ("Pack/hd/Swipe >.mp4", b"uninspected"),
            ("Pack/.DS_Store", b"junk"),
            ("__MACOSX/Pack/._Swipe.mp4", b"junk"),
            ("Pack/title.mogrt", b"template"),
        ])
        self.assertEqual([item["kind"] for item in index["entries"]], ["video", "editor-template"])
        self.assertEqual(len(index["excluded"]), 2)
        self.assertEqual(list(self.root.iterdir()), [self.archive])
        self.assertEqual(index["entries"][0]["verification"]["state"], "uninspected")

    def test_traversal_absolute_paths_drive_names_and_symlinks_are_rejected(self):
        for name in ["../outside.wav", "/absolute.wav", "C:/drive.wav", "safe/../../outside.wav"]:
            with self.subTest(name=name), self.assertRaises(ValueError):
                self.bundle([(name, b"test")])
        link = zipfile.ZipInfo("link.wav")
        link.create_system = 3
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        with self.assertRaises(ValueError):
            self.bundle([(link, b"/private/target")])

    def test_duplicate_paths_and_unselected_members_cannot_be_ambiguous(self):
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            with self.assertRaises(ValueError):
                self.bundle([("x.wav", b"a"), ("x.wav", b"b")])
        index = self.bundle([("x.wav", b"a")])
        with self.assertRaises(ValueError):
            catalog.selected(index, ["missing.wav"])
        with self.assertRaises(ValueError):
            catalog.selected(index, ["x.wav", "x.wav"])

    def test_archive_replacement_and_expansion_limits_are_detected(self):
        index = self.bundle([("x.wav", b"a" * 100)])
        with zipfile.ZipFile(self.archive) as archive:
            with self.assertRaises(ValueError):
                catalog.extract_member(archive, index["entries"][0], self.root / "sample", 99)
        self.assertFalse((self.root / "sample").exists())
        with self.archive.open("ab") as stream:
            stream.write(b"different")
        with self.assertRaises(ValueError):
            catalog.verify_archive(self.archive, index)

    def test_windows_member_separators_are_normalized_without_becoming_output_paths(self):
        index = self.bundle([("Pack\\Swipe >.wav", b"source bytes")])
        entry = index["entries"][0]
        self.assertEqual(entry["sourcePath"], "Pack/Swipe >.wav")
        with zipfile.ZipFile(self.archive) as archive:
            catalog.extract_member(archive, entry, self.root / "owned.wav", 1000)
        self.assertEqual((self.root / "owned.wav").read_bytes(), b"source bytes")

    def test_colons_in_archive_labels_never_become_windows_file_paths(self):
        index = self.bundle([("Pack/Slides:Swipes/On:Off.wav", b"source")])
        with zipfile.ZipFile(self.archive) as archive:
            catalog.extract_member(archive, index["entries"][0], self.root / "hash.wav", 100)
        self.assertEqual((self.root / "hash.wav").read_bytes(), b"source")

    def test_cube_validation_rejects_missing_extra_nonfinite_and_ambiguous_samples(self):
        valid = "LUT_3D_SIZE 2\n" + "0 0 0\n" * 8
        path = self.root / "valid.cube"
        path.write_text(valid, encoding="utf-8")
        self.assertEqual(catalog.inspect_cube(path)["samples"], 8)
        for data in [valid.rsplit("0 0 0\n", 1)[0], valid + "0 0 0\n", valid.replace("0 0 0", "nan 0 0", 1), valid + "LUT_1D_SIZE 2\n"]:
            path.write_text(data, encoding="utf-8")
            with self.assertRaises(ValueError):
                catalog.inspect_cube(path)

    def test_uninspected_entries_and_branded_labels_cannot_be_staged(self):
        index = self.bundle([("x.wav", wav_bytes())])
        entry = index["entries"][0]
        with self.assertRaises(ValueError):
            catalog.stage_entry(self.archive, index, entry, self.root / "public", "Neutral sound", 100000)
        with self.assertRaises(ValueError):
            catalog.stage_entry(self.archive, index, entry, self.root / "public", "Four Editors sound", 100000)

    @unittest.skipUnless(shutil.which("ffprobe") and shutil.which("ffmpeg"), "FFmpeg tools required")
    def test_real_audio_decode_staging_reuse_integrity_and_private_public_separation(self):
        index = self.bundle([("FourEditors/Swipe >.wav", wav_bytes())])
        entry = index["entries"][0]
        catalog.probe_entries(self.archive, index, [entry], 100000, 20)
        self.assertEqual(entry["verification"]["state"], "decoded")
        self.assertAlmostEqual(entry["technical"]["duration"], 0.1)
        output = self.root / "public"
        item = catalog.stage_entry(self.archive, index, entry, output, "Soft brush", 100000)
        manifest = {"schemaVersion": 1, "items": [item]}
        catalog.validate_public(output, manifest)
        self.assertNotIn("FourEditors", json.dumps(manifest))
        self.assertNotIn("sourcePath", json.dumps(manifest))
        self.assertEqual(item, catalog.stage_entry(self.archive, index, entry, output, "Soft brush", 100000))
        private = copy.deepcopy(manifest)
        private["items"][0]["technical"]["sourcePath"] = entry["sourcePath"]
        with self.assertRaises(ValueError):
            catalog.validate_public(output, private)
        (output / item["file"]).write_bytes(b"tampered")
        with self.assertRaises(ValueError):
            catalog.validate_public(output, manifest)

    @unittest.skipUnless(shutil.which("ffprobe") and shutil.which("ffmpeg"), "FFmpeg tools required")
    def test_invalid_media_never_becomes_a_verified_catalog_entry(self):
        index = self.bundle([("fake.mp4", b"not a video")])
        with self.assertRaises(subprocess.CalledProcessError):
            catalog.probe_entries(self.archive, index, index["entries"], 100000, 20)
        self.assertEqual(index["entries"][0]["verification"]["state"], "uninspected")


if __name__ == "__main__":
    unittest.main()
