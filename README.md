# DocuFrame

A modern desktop application built with Electron, React, and Chakra UI.

## Features

- Modern UI with Chakra UI components
- Cross-platform desktop application
- Hot reloading in development
- TypeScript support
- Vite for fast development and building

## Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)

## Development Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/DocuFrame.git
cd DocuFrame
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run electron:dev
```

## Building for Production

To create a production build:

```bash
npm run electron:build
```

The built application will be available in the `release` directory.

## Project Structure

```
DocuFrame/
├── electron/           # Electron main process files
├── src/               # React application source
├── public/            # Static assets
├── dist/              # Built application files
├── dist-electron/     # Built Electron files
└── release/           # Production builds
```

## Scripts

- `npm run dev` - Start Vite dev server
- `npm run electron:dev` - Start Electron in development mode
- `npm run build` - Build the application
- `npm run electron:build` - Build the Electron application
- `npm run lint` - Run ESLint
- `npm run preview` - Preview the production build

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
