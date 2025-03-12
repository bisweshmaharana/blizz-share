#!/bin/bash

# Install TypeScript and type definitions explicitly
npm install --save typescript@5.2.2 @types/react@18.2.24 @types/node@20.8.2 @types/react-dom@18.2.8

# Install CSS processing dependencies
npm install --save postcss-nested@7.0.2

# Run the build
npm run build
