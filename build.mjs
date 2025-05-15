import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';

const useWasmMinifier = process.env.FAST_BUILD !== 'true';

const glslPlugin = {
  name: 'glsl-conditional-minify',
  setup(build) {
    build.onLoad({ filter: /\.(vert|frag|glsl)$/ }, async (args) => {
      try {
        const shaderContent = await fs.readFile(args.path, 'utf8');
        let outputShader = shaderContent;

        if (useWasmMinifier) {
          console.log(`Minifying shader ${args.path} with shader-minifier-wasm...`);
          const {minifyWasm} = await import('shader-minifier-wasm');
          outputShader = await minifyWasm(shaderContent, { preserveExternals: true, format: 'text' });
        } else {
          console.log(`Skipping WASM minification for shader ${args.path} (FAST_BUILD mode).`);
        }
        
        return {
          contents: `export default \`${outputShader}\`;`,
          loader: 'js',
        };
      } catch (error) {
        error.message = `Error processing shader ${args.path}: ${error.message}`;
        return {
          errors: [{ text: error.message, detail: error.stack }],
        };
      }
    });
  },
};

async function runBuild() {
  try {
    await build({
      entryPoints: ['src/webgl-page-curl.js'],
      bundle: true,
      outfile: 'dist/webgl-page-curl.js',
      format: 'esm',
      minify: true,
      sourcemap: true,
      plugins: [glslAdvancedMinifyPlugin],
    });
    console.log(`Build successful! ${useWasmMinifier ? 'with shader-minifier-wasm' : '(FAST_BUILD mode, WASM minifier skipped)'}`);
  } catch (error) {
    console.error('Build failed:', error.errors || error);
    process.exit(1);
  }
}

runBuild(); 