'use client';

import { Container, Title, Paper, Grid, Stack, Group, Badge, Tabs, ActionIcon } from '@mantine/core';
import { IconTrendingUp, IconActivity, IconNews, IconAlertTriangle, IconList, IconChartLine } from '@tabler/icons-react';
import { SymbolInput } from '@/components/SymbolInput';
import { HaltsTable } from '@/components/HaltsTable';
import { SymbolList } from '@/components/SymbolList';
import { SymbolAnalysis } from '@/components/SymbolAnalysis';
import { useState, useEffect } from 'react';

export default function HomePage() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>('home');
  const [symbolTabs, setSymbolTabs] = useState<string[]>([]);

  // Load symbols from localStorage on mount
  useEffect(() => {
    const savedSymbols = localStorage.getItem('mariom-symbols');
    if (savedSymbols) {
      try {
        const parsed = JSON.parse(savedSymbols);
        setSymbols(parsed);
      } catch (error) {
        console.error('Error loading saved symbols:', error);
      }
    }
  }, []);

  // Save symbols to localStorage whenever symbols change
  useEffect(() => {
    localStorage.setItem('mariom-symbols', JSON.stringify(symbols));
  }, [symbols]);

  const handleSymbolAdded = (symbol: string) => {
    setSymbols(prev => {
      if (prev.includes(symbol)) {
        return prev; // Don't add duplicates
      }
      return [...prev, symbol];
    });
    
    // Automatically create a tab for the new symbol and switch to it
    if (!symbolTabs.includes(symbol)) {
      setSymbolTabs(prev => [...prev, symbol]);
    }
    setActiveTab(`symbol-${symbol}`);
  };

  const handleClearAll = () => {
    setSymbols([]);
    setSymbolTabs([]);
    // Clear from localStorage
    localStorage.removeItem('mariom-symbols');
    // Go back to home tab
    setActiveTab('home');
  };

  const handleSymbolClick = (symbol: string) => {
    // Add symbol to persistent list if not already there
    if (!symbols.includes(symbol)) {
      setSymbols(prev => [...prev, symbol]);
    }
    
    // Add symbol tab if it doesn't exist
    if (!symbolTabs.includes(symbol)) {
      setSymbolTabs(prev => [...prev, symbol]);
    }
    // Switch to symbol tab
    setActiveTab(`symbol-${symbol}`);
  };

  const handleBackToHome = () => {
    setActiveTab('home');
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Group gap="md">
            <IconTrendingUp size={32} color="var(--mantine-color-blue-6)" />
            <Title order={1} c="blue">MARIOM Stock Dashboard</Title>
          </Group>
          <Group gap="xs">
            <Badge variant="light" color="green" leftSection={<IconActivity size={14} />}>
              Live Data
            </Badge>
            <Badge variant="light" color="blue" leftSection={<IconNews size={14} />}>
              Real-time Updates
            </Badge>
          </Group>
        </Group>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onChange={setActiveTab} variant="outline">
          <Tabs.List>
            <Tabs.Tab 
              value="home" 
              leftSection={<IconChartLine size={16} />}
              color="blue"
            >
              🏠 Home ({symbols.length} symbols)
            </Tabs.Tab>
            
            {/* Dynamic Symbol Tabs */}
            {symbolTabs.map(symbol => (
              <Tabs.Tab 
                key={`symbol-${symbol}`}
                value={`symbol-${symbol}`}
                leftSection={<IconTrendingUp size={14} />}
                color="teal"
                rightSection={
                  <span
                    style={{ 
                      cursor: 'pointer', 
                      padding: '2px 4px', 
                      borderRadius: '2px',
                      fontSize: '12px',
                      color: 'var(--mantine-color-gray-6)',
                      fontWeight: 'bold'
                    }}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      setSymbolTabs(prev => prev.filter(s => s !== symbol));
                      if (activeTab === `symbol-${symbol}`) {
                        setActiveTab('home');
                      }
                    }}
                  >
                    ✕
                  </span>
                }
              >
                {symbol}
              </Tabs.Tab>
            ))}
          </Tabs.List>

          <Tabs.Panel value="home" pt="md">
            {/* Home Tab - Symbol Management + Halts Table */}
            <Grid>
              {/* Left Column - Symbol Management (1/3) */}
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Stack gap="md">
                  <Paper shadow="sm" p="md" radius="md" withBorder>
                    <SymbolInput onSymbolAdded={handleSymbolAdded} />
                  </Paper>
                  
                  <Paper shadow="sm" p="md" radius="md" withBorder>
                    <SymbolList 
                      symbols={symbols} 
                      onClearAll={handleClearAll}
                      onSymbolClick={handleSymbolClick}
                      showDetails={true}
                    />
                  </Paper>
                </Stack>
              </Grid.Col>

              {/* Right Column - Halts Table (2/3) */}
              <Grid.Col span={{ base: 12, md: 8 }}>
                <Paper shadow="sm" p="md" radius="md" withBorder>
                  <HaltsTable onSymbolClick={handleSymbolClick} />
                </Paper>
              </Grid.Col>
            </Grid>
          </Tabs.Panel>

          {/* Dynamic Symbol Analysis Tabs */}
          {symbolTabs.map(symbol => (
            <Tabs.Panel key={`symbol-${symbol}`} value={`symbol-${symbol}`} pt="md">
              <Paper shadow="sm" p="md" radius="md">
                <SymbolAnalysis 
                  symbol={symbol} 
                  onBackToHome={handleBackToHome}
                />
              </Paper>
            </Tabs.Panel>
          ))}
        </Tabs>
      </Stack>
    </Container>
  );
}
