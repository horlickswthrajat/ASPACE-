const fs = require('fs');

try {
    const buf = fs.readFileSync('public/reze__stylized_anime_girl.glb');

    // GLB headers
    const magic = buf.readUInt32LE(0);
    const version = buf.readUInt32LE(4);
    const length = buf.readUInt32LE(8);

    // Chunk 0 header
    const chunkLength = buf.readUInt32LE(12);
    const chunkType = buf.readUInt32LE(16); // Should be 0x4E4F534A 'JSON'

    const jsonStr = buf.toString('utf8', 20, 20 + chunkLength);
    const gltf = JSON.parse(jsonStr);

    if (gltf.animations) {
        console.log("Animations found: ", gltf.animations.map(a => a.name));
    } else {
        console.log("No animations found in GLB structure.");
    }
} catch (e) {
    console.error("Error reading GLB:", e.message);
}
