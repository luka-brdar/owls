// Webpack 4 needs --openssl-legacy-provider to run on Node 17+, but Electron's
// bundled Node rejects that flag in NODE_OPTIONS. The OpenSSL legacy provider is
// loaded once at process startup, so stripping the flag here (after the CLI
// process has started) keeps webpack hashing working while preventing the
// spawned Electron child from inheriting a flag it refuses to launch with.
if (process.env.NODE_OPTIONS) {
  process.env.NODE_OPTIONS = process.env.NODE_OPTIONS
    .replace(/--openssl-legacy-provider/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!process.env.NODE_OPTIONS) delete process.env.NODE_OPTIONS
}

module.exports = {
  pluginOptions: {
    electronBuilder: {
      nodeIntegration: true,
      builderOptions: {
        appId: 'com.electron.owls',
        productName: 'Owls',
        publish: ['github'],
        mac: {
          target: [
            { target: 'dmg', arch: 'universal' },
            { target: 'zip', arch: 'universal' }
          ],
          artifactName: '${productName}-${os}.${ext}'
        },
        linux: {
          artifactName: '${productName}-${os}.${ext}',
          target: [
            {
              target: 'snap',
              arch: 'x64',
            },
            {
              target: 'tar.gz',
              arch: 'x64'
            }
          ]
        },
        win: {
          artifactName: '${productName}-${os}.${ext}'
        },
        snap: {
          publish: ['github']
        }
      },
      mainProcessWatch: []
    }
  }
}