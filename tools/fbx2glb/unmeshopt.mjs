// unmeshopt.mjs — dev: unpacks a meshopt-compressed GLB (some generators ship them) so the compressor can re-read it.
//   node tools/fbx2glb/unmeshopt.mjs IN.glb OUT.glb
import path from 'node:path'; import os from 'node:os'; import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);   // needs: npm i @gltf-transform/core @gltf-transform/extensions meshoptimizer
const { NodeIO } = req('@gltf-transform/core'), { ALL_EXTENSIONS } = req('@gltf-transform/extensions'), { MeshoptDecoder } = req('meshoptimizer');
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(process.argv[2]);
for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName === 'EXT_meshopt_compression' || e.extensionName === 'KHR_mesh_quantization') e.dispose();
await io.write(process.argv[3], doc); console.log('ok', process.argv[3]);
