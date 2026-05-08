const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

exports.default = async function afterSign(context) {
  if (process.platform !== 'darwin') return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  if (!fs.existsSync(appPath)) return;
  // Ad-hoc signing does not replace Apple Developer ID notarization, but it prevents
  // malformed/unsigned bundle integrity failures and makes the unsigned build easier
  // for testers to open after removing quarantine.
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
};
