import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TemplatesList } from './pages/TemplatesList';
import { Builder } from './pages/Builder';
import { Fill } from './pages/Fill';
import { InstancesList } from './pages/InstancesList';
import { InstanceView } from './pages/InstanceView';
import { DevToolsMenu } from './components/DevToolsMenu';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TemplatesList />} />
        <Route path="/templates/new" element={<Builder />} />
        <Route path="/templates/:templateId/edit" element={<Builder />} />
        <Route path="/templates/:templateId/fill" element={<Fill />} />
        <Route path="/templates/:templateId/instances" element={<InstancesList />} />
        <Route path="/instances/:instanceId" element={<InstanceView />} />
      </Routes>
      <DevToolsMenu />
    </BrowserRouter>
  );
}
