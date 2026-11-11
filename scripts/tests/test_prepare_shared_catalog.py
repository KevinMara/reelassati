import importlib.util
from pathlib import Path
import tempfile
import unittest
import zipfile

script = Path(__file__).resolve().parents[1] / "prepare-shared-catalog.py"
spec = importlib.util.spec_from_file_location("prepare_shared", script)
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)


class SharedPreparationTests(unittest.TestCase):
    def test_sanitized_lut_keeps_every_numeric_sample_and_private_source_identity(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            text = 'TITLE "Private supplier"\n# Four Editors source\nLUT_3D_SIZE 2\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n' + "\n".join(f"{r} {g} {b}" for b in range(2) for g in range(2) for r in range(2)) + "\n"
            archive = root / "source.zip"
            with zipfile.ZipFile(archive, "w") as bundle:
                bundle.writestr("Pack/Looks/Private.cube", text)
            index = prepare.media_index.scan(archive, "Private supplier", "Explicit platform rights")
            work = root / "temporary"; work.mkdir()
            with zipfile.ZipFile(archive) as bundle:
                item, private = prepare.prepare(index["entries"][0], bundle, root / "delivery", work, {"name":"Film looks","tags":["film"]}, "Film look 01", "look-01", 30)
            public = (root / "delivery" / item["media"]["file"]).read_text()
            self.assertNotIn("TITLE", public)
            self.assertNotIn("Four", public)
            self.assertEqual(prepare.media_index.inspect_cube(root / "delivery" / item["media"]["file"])["samples"], 8)
            self.assertEqual(item["lut"]["dimension"], 3)
            self.assertNotEqual(private["sourceSha256"], item["media"]["sha256"])
            self.assertEqual(private["sourcePath"], "Pack/Looks/Private.cube")
            self.assertNotIn("sourcePath", item)

    def test_unvalidated_cube_cannot_create_a_catalog_item(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); archive = root / "source.zip"
            with zipfile.ZipFile(archive, "w") as bundle: bundle.writestr("Pack/Looks/Broken.cube", "LUT_3D_SIZE 2\n0 0 0\n")
            index = prepare.media_index.scan(archive, "Private", "Explicit rights")
            work = root / "temporary"; work.mkdir()
            with zipfile.ZipFile(archive) as bundle, self.assertRaises(ValueError):
                prepare.prepare(index["entries"][0], bundle, root / "delivery", work, {"name":"Looks","tags":[]}, "Look", "look-1", 30)
            self.assertFalse((root / "delivery").exists())


if __name__ == "__main__": unittest.main()
