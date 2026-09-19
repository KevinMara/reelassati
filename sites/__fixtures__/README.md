# Music parser fixtures

Original test signals generated locally, not third-party music or stock sounds.

- `music-mp3-vbr.mp3`: 4-second 440 Hz tone; 44,100 Hz stereo; LAME VBR, Xing/LAME gapless metadata.
- `music-mp3-cbr.mp3`: 4-second 660 Hz tone; 48,000 Hz stereo; LAME 128 kbps CBR without a Xing index.

Commands used:

```sh
ffmpeg -f lavfi -i sine=frequency=440:duration=4 -ar 44100 -ac 2 -c:a libmp3lame -q:a 4 -map_metadata -1 music-mp3-vbr.mp3
ffmpeg -f lavfi -i sine=frequency=660:duration=4 -ar 48000 -ac 2 -c:a libmp3lame -b:a 128k -write_xing 0 -map_metadata -1 music-mp3-cbr.mp3
```

These files test codec handling and timing only. They are never exposed as music-library items or demonstrations of AI generation quality.
