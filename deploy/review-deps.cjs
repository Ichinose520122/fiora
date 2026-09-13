const fs = require('fs');
const path = require('path');
const names = ['assets', 'config', 'utils', 'database', 'bin', 'server', 'web'];
const original = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const dependencies = {};
for (const name of names) {
    const pkg = JSON.parse(fs.readFileSync('packages/' + name + '/package.json', 'utf8'));
    Object.assign(dependencies, pkg.dependencies, pkg.devDependencies);
}
Object.assign(dependencies, original.devDependencies, original.dependencies);
for (const name of Object.keys(dependencies)) {
    if (name.startsWith('@fiora/') || name === 'lerna') delete dependencies[name];
}
fs.writeFileSync('package.json', JSON.stringify({name:'fiora-review', private:true, dependencies}, null, 2));
if (process.argv.includes('--links')) {
    fs.mkdirSync('node_modules/@fiora', {recursive:true});
    for (const name of names) {
        const target = 'node_modules/@fiora/' + name;
        if (!fs.existsSync(target)) fs.symlinkSync('../../packages/' + name, target, 'dir');
    }
}
