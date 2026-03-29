import express from "express";
import { exec } from "child_process";
import fs from "fs";
import axios from "axios";

const app = express();
app.use(express.json());

async function downloadFile(url, path) {
  const writer = fs.createWriteStream(path);
  const response = await axios({
    url,
    method: "GET",
    responseType: "stream"
  });

  return new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

app.post("/render", async (req, res) => {
  try {
    const { video_url, audio_url, text } = req.body;

    const id = Date.now();

    const videoPath = `/tmp/video_${id}.mp4`;
    const audioPath = `/tmp/audio_${id}.mp3`;
    const outputPath = `/tmp/output_${id}.mp4`;

    await downloadFile(video_url, videoPath);
    await downloadFile(audio_url, audioPath);

    const safeText = text
      .replace(/:/g, "\\:")
      .replace(/'/g, "\\'");

    const cmd = `
    ffmpeg -y \
    -stream_loop -1 -i input.mp4 \
    -i input.mp3 \
    -filter_complex "[0:v]scale=480:854,setsar=1[v];[v]drawtext=text='TEXT':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=h-100:box=1:boxcolor=black@0.5[vout]" \
    -map "[vout]" \
    -map 1:a \
    -shortest \
    -r 24 \
    -preset ultrafast \
    -crf 28 \
    -threads 1 \
    -c:v libx264 \
    -c:a aac \
    output.mp4
    `;

    exec(cmd, (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.json({
        success: true,
        output: outputPath
      });
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log("FFmpeg API running on port 3000"));
