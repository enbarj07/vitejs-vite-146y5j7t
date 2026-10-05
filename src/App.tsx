import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import Home from './screens/Home';
import NuevoFolio from './screens/NuevoFolio';
import CapturaHU from './screens/CapturaHU';
import EditarFolio from './screens/EditarFolio';
import Historial from './screens/Historial';
import BotonInstalar from './components/BotonInstalar';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Home />}
        />

        <Route
          path="/nuevo-folio"
          element={<NuevoFolio />}
        />

        <Route
          path="/captura/:id"
          element={<CapturaHU />}
        />

        <Route
          path="/editar-folio/:id"
          element={<EditarFolio />}
        />
        <Route
          path="/historial"
          element={<Historial />}
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />
      </Routes>

      <BotonInstalar />
    </BrowserRouter>
  );
}
