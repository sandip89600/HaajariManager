import Groq, { toFile } from "groq-sdk";

async function test() {
  try {
    console.log("Imported toFile successfully:", typeof toFile);
    const buffer = Buffer.from("dummy audio data");
    const fileObj = await toFile(buffer, "audio.m4a", { type: "audio/mp4" });
    console.log("File object created:", fileObj);
  } catch (err: any) {
    console.error("Failed to call toFile:", err.message);
  }
}

test();
