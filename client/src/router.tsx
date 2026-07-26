import { createBrowserRouter } from 'react-router-dom';
import Home from './pages/Home';
import Search from './pages/Search';
import SingleGame from './pages/SingleGame';
import SingleLobby from './pages/SingleLobby';
import NotFound from './pages/NotFound';
import RouteError from './components/RouteError';

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/search', element: <Search /> },
      { path: '/single', element: <SingleLobby /> },
      { path: '/single/:difficulty', element: <SingleGame /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
