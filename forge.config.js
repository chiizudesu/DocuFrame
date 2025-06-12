const path = require('path');

module.exports = {
  packagerConfig: {
    name: 'DocuFrame',
    appBundleId: 'com.edwardmatias.docuframe',
    icon: path.resolve(__dirname, 'public', 'icon'), // Adjust if you have an icon
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'DocuFrame',
        setupIcon: path.resolve(__dirname, 'public', '256.ico'),
        authors: 'Edward Matias',
        owners: 'Edward Matias',
        description: 'DocuFrame - Modern File Manager',
        shortcutName: 'DocuFrame',
      },
    },
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'chiizudesu',
          name: 'DocuFrame',
        },
        prerelease: false,
        draft: true,
      },
    },
  ],
  hooks: {},
  buildIdentifier: 'prod',
  // Include all necessary files for the app and backend
  // (Forge uses package.json "files" by default, but you can override here if needed)
  // See: https://www.electronforge.io/config/configuration
}; 