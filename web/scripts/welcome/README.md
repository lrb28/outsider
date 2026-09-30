# Welcome screen video

The welcome screen plays the silk animation of the user's two reference videos
(`388513fa-….mp4` light, `16477574-….mp4` dark; 1080×1080, 60 fps, a phone
mock-up with a wallet app's first screen). The files in `public/welcome/` are
made from them like this (macOS, no ffmpeg needed):

1. **Frames** – every frame, cropped to the phone screen (x 339, y 108,
   399×866):

       swiftc -O extract.swift -o /tmp/extract
       /tmp/extract light.mp4 WORK/light 339 108 399 866
       /tmp/extract dark.mp4  WORK/dark  339 108 399 866

2. **Clean loop** – `python3 clean.py WORK` (numpy, opencv, Pillow). The
   animation repeats every 60 frames (one second), so each loop frame is the
   average of the video's five copies; the clock, island, icons, logo,
   headline, buttons, home bar and rounded corners are painted out along the
   silk's streaks; result `WORK/final_{light,dark}/c000…c059.png`, 390×846.

3. **Upscale** – Real-ESRGAN (`realesrgan-ncnn-vulkan`, model
   `realesrgan-x4plus`, runs on the Mac's GPU) to 4×, then `post.py`: Lanczos
   down to 1170×2538 (3× an iPhone), a cyclic [1, 2, 1] blend of neighbouring
   frames against the upscaler's shimmer, and the first frame as the poster:

       realesrgan-ncnn-vulkan -i WORK/final_light -o WORK/up_light -n realesrgan-x4plus -s 4 -f png
       python3 post.py WORK/up_light WORK/3x_light public/welcome/silk-light.jpg

4. **Encode** – three loops per file, HEVC for Apple devices and H.264 for
   the rest:

       swiftc -O encode.swift -o /tmp/encode
       /tmp/encode WORK/3x_light public/welcome/silk-light-hevc.mp4 hevc 9000000 3
       /tmp/encode WORK/3x_light public/welcome/silk-light.mp4 h264 14000000 3

`components/SilkVideo.tsx` picks light or dark from the theme.
