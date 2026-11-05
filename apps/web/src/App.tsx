import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { RenderErrorBoundary } from './components/ErrorBanner';
import { CareerPage } from './pages/CareerPage';
import { FinancePage } from './pages/FinancePage';
import { LifePage } from './pages/LifePage';
import { MorePage } from './pages/MorePage';
import { NewLifePage } from './pages/NewLifePage';
import { ProfilePage } from './pages/ProfilePage';
import { RelationshipDetailPage } from './pages/RelationshipDetailPage';
import { RelationshipsPage } from './pages/RelationshipsPage';
import { SocietyPage } from './pages/SocietyPage';
import { WorldPage } from './pages/WorldPage';
import { useGame } from './game/store';
import { useLocale } from './i18n/locale';

export function App() {
  const init = useGame((s) => s.init);
  const locale = useLocale((s) => s.locale);
  useEffect(() => {
    void init();
  }, [init]);

  return (
    <RenderErrorBoundary key={locale}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<LifePage />} />
            <Route path="relazioni" element={<RelationshipsPage />} />
            <Route path="relazioni/:id" element={<RelationshipDetailPage />} />
            <Route path="carriera" element={<CareerPage />} />
            <Route path="finanze" element={<FinancePage />} />
            <Route path="altro" element={<MorePage />} />
            <Route path="profilo" element={<ProfilePage />} />
            <Route path="nuova-vita" element={<NewLifePage />} />
            <Route path="mondo" element={<WorldPage />} />
            <Route path="societa" element={<SocietyPage />} />
            <Route path="*" element={<LifePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </RenderErrorBoundary>
  );
}
