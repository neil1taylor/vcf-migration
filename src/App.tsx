// Main application component
import { RouterProvider } from 'react-router-dom';
import { DataProvider, ThemeProvider } from '@/context';
import { ErrorBoundary } from '@/components/common';
import { router } from './router';

// Import styles (Carbon is loaded via SCSS)
import './App.scss';

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <DataProvider>
          <RouterProvider router={router} />
        </DataProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
