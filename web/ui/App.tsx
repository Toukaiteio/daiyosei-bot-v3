import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ConfigPatch, TabId } from './types';
import { AppShell } from './components/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { LogsPage } from './pages/LogsPage';
import { MemoryPage } from './pages/MemoryPage';
import { MemesPage } from './pages/MemesPage';
import { CommandsPage } from './pages/CommandsPage';
import { OneBotPage } from './pages/OneBotPage';
import { PluginsPage } from './pages/PluginsPage';
import { ProvidersPage } from './pages/ProvidersPage';
import { SettingsPage } from './pages/SettingsPage';
import { SkillsPage } from './pages/SkillsPage';
import { fetchHealth, fetchMemes, fetchPlugins, fetchSkills, fetchStatus, updateConfig } from './api';

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const queryClient = useQueryClient();

  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 5000,
  });

  const statusQuery = useQuery({
    queryKey: ['status'],
    queryFn: fetchStatus,
    refetchInterval: 10000,
  });

  const skillsQuery = useQuery({
    queryKey: ['skills'],
    queryFn: fetchSkills,
  });

  const pluginsQuery = useQuery({
    queryKey: ['plugins'],
    queryFn: fetchPlugins,
  });

  const memesQuery = useQuery({
    queryKey: ['memes'],
    queryFn: fetchMemes,
  });

  const saveConfigMutation = useMutation({
    mutationFn: updateConfig,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['status'] });
      await queryClient.invalidateQueries({ queryKey: ['memes'] });
    },
  });

  const saveConfig = async (patch: ConfigPatch) => {
    try {
      await saveConfigMutation.mutateAsync(patch);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save configuration';
      window.alert(message);
      throw error;
    }
  };

  let page = null;
  switch (activeTab) {
    case 'dashboard':
      page = (
        <DashboardPage
          health={healthQuery.data}
          status={statusQuery.data}
          plugins={pluginsQuery.data}
          skills={skillsQuery.data}
          onNavigate={setActiveTab}
        />
      );
      break;
    case 'settings':
      page = (
        <SettingsPage status={statusQuery.data} isSaving={saveConfigMutation.isPending} onSave={saveConfig} />
      );
      break;
    case 'providers':
      page = (
        <ProvidersPage status={statusQuery.data} isSaving={saveConfigMutation.isPending} onSave={saveConfig} />
      );
      break;
    case 'memory':
      page = <MemoryPage status={statusQuery.data} />;
      break;
    case 'memes':
      page = (
        <MemesPage
          status={statusQuery.data}
          library={memesQuery.data}
          isSaving={saveConfigMutation.isPending}
          onSave={saveConfig}
        />
      );
      break;
    case 'plugins':
      page = <PluginsPage plugins={pluginsQuery.data} />;
      break;
    case 'skills':
      page = <SkillsPage skills={skillsQuery.data} />;
      break;
    case 'onebot':
      page = <OneBotPage status={statusQuery.data} isSaving={saveConfigMutation.isPending} onSave={saveConfig} />;
      break;
    case 'commands':
      page = <CommandsPage status={statusQuery.data} isSaving={saveConfigMutation.isPending} onSave={saveConfig} />;
      break;
    case 'logs':
      page = <LogsPage />;
      break;
  }

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
      {page}
    </AppShell>
  );
}
