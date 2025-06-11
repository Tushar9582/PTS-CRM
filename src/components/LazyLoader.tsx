// Create a new file: src/components/LazyLoader.tsx
import React from 'react';

const LazyLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary">
        <h1 className='text-black'>Please wait its Loading for You</h1>
    </div>
  </div>
);

export default LazyLoader;

