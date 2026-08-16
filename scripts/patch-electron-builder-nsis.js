const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const targetPath = path.join(rootDir, "node_modules", "app-builder-lib", "out", "targets", "nsis", "NsisTarget.js");

const marker = "card-vault-nsis-uninstaller-temp-output";

const original = `        const uninstallerPath = path.join(this.outDir, \`\${path.basename(installerPath, "exe")}__uninstaller.exe\`);
        const isWin = process.platform === "win32";
        defines.BUILD_UNINSTALLER = null;
        defines.UNINSTALLER_OUT_FILE = isWin ? uninstallerPath : path.win32.join("Z:", uninstallerPath);
        await this.executeMakensis(defines, commands, sharedHeader + (await this.computeFinalScript(script, false, archs)));
        // http://forums.winamp.com/showthread.php?p=3078545`;

const patched = `        const uninstallerPath = path.join(this.outDir, \`\${path.basename(installerPath, "exe")}__uninstaller.exe\`);
        const uninstallerInstallerPath = path.join(this.outDir, \`\${path.basename(installerPath, ".exe")}__uninstaller_builder.exe\`);
        const isWin = process.platform === "win32";
        const originalOutFile = commands.OutFile;
        defines.BUILD_UNINSTALLER = null;
        defines.UNINSTALLER_OUT_FILE = isWin ? uninstallerPath : path.win32.join("Z:", uninstallerPath);
        // ${marker}: keep the temporary uninstaller builder executable separate from the final installer output.
        commands.OutFile = \`"\${uninstallerInstallerPath}"\`;
        await this.executeMakensis(defines, commands, sharedHeader + (await this.computeFinalScript(script, false, archs)));
        commands.OutFile = originalOutFile;
        // http://forums.winamp.com/showthread.php?p=3078545`;

const originalExec = `                await nsisUtil_1.UninstallerReader.exec(installerPath, uninstallerPath);`;
const patchedExec = `                await nsisUtil_1.UninstallerReader.exec(uninstallerInstallerPath, uninstallerPath);`;

const originalVmExec = `                await vm.exec(installerPath, []);`;
const patchedVmExec = `                await vm.exec(uninstallerInstallerPath, []);`;

const originalWineExec = `            await wineVm.exec(installerPath, [], { env: { __COMPAT_LAYER: "RunAsInvoker" } });`;
const patchedWineExec = `            await wineVm.exec(uninstallerInstallerPath, [], { env: { __COMPAT_LAYER: "RunAsInvoker" } });`;

const originalSign = `        await packager.signIf(uninstallerPath);
        delete defines.BUILD_UNINSTALLER;`;
const patchedSign = `        await packager.signIf(uninstallerPath);
        await (0, fs_extra_1.unlink)(uninstallerInstallerPath).catch(() => undefined);
        delete defines.BUILD_UNINSTALLER;`;

function replaceOnce(source, from, to, label) {
  const next = source.replace(from, to);
  if (next === source) {
    throw new Error(`Unable to patch electron-builder NSIS target: ${label} pattern was not found.`);
  }
  return next;
}

if (!fs.existsSync(targetPath)) {
  throw new Error(`electron-builder NSIS target was not found: ${targetPath}`);
}

let source = fs.readFileSync(targetPath, "utf8");
if (source.includes(marker)) {
  process.stdout.write("electron-builder NSIS temp output patch already applied.\n");
  process.exit(0);
}

source = replaceOnce(source, original, patched, "temporary output");
source = replaceOnce(source, originalExec, patchedExec, "uninstaller reader");
source = replaceOnce(source, originalVmExec, patchedVmExec, "vm execution");
source = replaceOnce(source, originalWineExec, patchedWineExec, "wine execution");
source = replaceOnce(source, originalSign, patchedSign, "temporary cleanup");

fs.writeFileSync(targetPath, source, "utf8");
process.stdout.write("electron-builder NSIS temp output patch applied.\n");
