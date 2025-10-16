'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Group,
  Text,
  Button,
  Stack,
  Badge,
  Alert,
  Loader,
  Table,
  JsonInput,
  Tabs,
  ActionIcon,
  Tooltip,
  Code,
  ScrollArea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { 
  IconRefresh, 
  IconDownload, 
  IconChartLine, 
  IconNews, 
  IconList,
  IconAlertTriangle,
  IconDatabase,
  IconCheck
} from '@tabler/icons-react';

interface TMXSessionData {
  sessionId: string;
  userId: string;
  wmid: string;
  forwardURL: string;
  loginTime: string;
  expiresAt: string;
}

interface TMXDataExtractorProps {
  symbols?: string[];
  autoRefresh?: boolean;
  refreshInterval?: number;
}

type DataType = 'quotes' | 'level2' | 'charts' | 'news' | 'portfolio';

export default function TMXDataExtractor({ 
  symbols = ['AAPL', 'TSLA', 'GOOGL'], 
  autoRefresh = false,
  refreshInterval = 30000 
}: TMXDataExtractorProps) {
  const [sessionData, setSessionData] = useState<TMXSessionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<DataType>('quotes');
  const [sessionActive, setSessionActive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Load session data from localStorage on component mount
  useEffect(() => {
    const stored = localStorage.getItem('tmxSessionData');
    if (stored) {
      try {
        const parsedData = JSON.parse(stored);
        setSessionData(parsedData);
        checkSessionStatus();
      } catch (error) {
        console.error('Error parsing stored session data:', error);
      }
    }
  }, []);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh && sessionActive && activeTab) {
      const interval = setInterval(() => {
        fetchData(activeTab);
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, sessionActive, activeTab, refreshInterval]);

  const checkSessionStatus = async () => {
    try {
      const response = await fetch('/api/tmx-data');
      const result = await response.json();
      
      setSessionActive(result.sessionActive || false);
      
      if (!result.sessionActive) {
        notifications.show({
          title: 'Session Expired',
          message: 'TMX PowerStream session has expired. Please login again.',
          color: 'orange',
        });
      }
    } catch (error) {
      console.error('Session status check failed:', error);
      setSessionActive(false);
    }
  };

  const fetchData = async (dataType: DataType) => {
    if (!sessionData) {
      notifications.show({
        title: 'No Session',
        message: 'Please login to TMX PowerStream first',
        color: 'red',
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/tmx-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbols: symbols,
          dataType: dataType,
          sessionId: sessionData.sessionId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setData(result.data);
        setLastUpdate(new Date());
        setSessionActive(true);
        
        notifications.show({
          title: 'Data Updated',
          message: `Successfully fetched ${dataType} data from TMX PowerStream`,
          color: 'green',
        });
      } else {
        throw new Error(result.error || `Failed to fetch ${dataType} data`);
      }
    } catch (error) {
      console.error('Data fetch error:', error);
      notifications.show({
        title: 'Fetch Failed',
        message: error instanceof Error ? error.message : 'Failed to fetch data',
        color: 'red',
      });
      
      if (error instanceof Error && error.message.includes('session')) {
        setSessionActive(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadData = () => {
    if (!data) return;

    const jsonData = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `tmx-${activeTab}-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    notifications.show({
      title: 'Download Complete',
      message: 'TMX data exported successfully',
      color: 'blue',
    });
  };

  const renderDataTable = () => {
    if (!data) return null;

    if (data.quotes && Array.isArray(data.quotes)) {
      return (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Symbol</Table.Th>
              <Table.Th>Price</Table.Th>
              <Table.Th>Timestamp</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.quotes.map((quote: any, index: number) => (
              <Table.Tr key={index}>
                <Table.Td>
                  <Text fw={600}>{quote.symbol}</Text>
                </Table.Td>
                <Table.Td>
                  <Text c="green">${quote.price?.toFixed(2) || 'N/A'}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {new Date(quote.timestamp).toLocaleTimeString()}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      );
    }

    if (data.news && Array.isArray(data.news)) {
      return (
        <Stack gap="xs">
          {data.news.map((item: any, index: number) => (
            <Card key={index} padding="sm" withBorder>
              <Text size="sm">{item.headline}</Text>
              <Text size="xs" c="dimmed">
                {new Date(item.timestamp).toLocaleString()}
              </Text>
            </Card>
          ))}
        </Stack>
      );
    }

    return null;
  };

  if (!sessionData) {
    return (
      <Alert icon={<IconAlertTriangle size={16} />} color="orange">
        <Text fw={600}>TMX PowerStream Session Required</Text>
        <Text size="sm" mt="xs">
          Please use the "TMX Real Time Data" tab to access live market data.
        </Text>
      </Alert>
    );
  }

  return (
    <Card shadow="md" padding="lg" radius="md">
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Text size="lg" fw={600}>TMX PowerStream Data Extractor</Text>
            <Group gap="xs" mt={4}>
              <Badge 
                size="sm" 
                color={sessionActive ? 'green' : 'red'} 
                variant="light"
              >
                {sessionActive ? 'Session Active' : 'Session Inactive'}
              </Badge>
              {lastUpdate && (
                <Text size="xs" c="dimmed">
                  Last: {lastUpdate.toLocaleTimeString()}
                </Text>
              )}
            </Group>
          </div>
          
          <Group gap="xs">
            <Tooltip label="Check session status">
              <ActionIcon 
                variant="light" 
                onClick={checkSessionStatus}
                loading={loading}
              >
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
            
            {data && (
              <Tooltip label="Download data as JSON">
                <ActionIcon variant="light" color="blue" onClick={downloadData}>
                  <IconDownload size={16} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Group>

        {/* Data Type Tabs */}
        <Tabs value={activeTab} onChange={(value) => setActiveTab(value as DataType)}>
          <Tabs.List>
            <Tabs.Tab value="quotes" leftSection={<IconChartLine size={14} />}>
              Quotes
            </Tabs.Tab>
            <Tabs.Tab value="level2" leftSection={<IconDatabase size={14} />}>
              Level 2
            </Tabs.Tab>
            <Tabs.Tab value="charts" leftSection={<IconChartLine size={14} />}>
              Charts
            </Tabs.Tab>
            <Tabs.Tab value="news" leftSection={<IconNews size={14} />}>
              News
            </Tabs.Tab>
            <Tabs.Tab value="portfolio" leftSection={<IconList size={14} />}>
              Portfolio
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value={activeTab} pt="md">
            <Stack gap="md">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Symbols: {symbols.join(', ')}
                </Text>
                
                <Button
                  size="sm"
                  leftSection={<IconRefresh size={14} />}
                  onClick={() => fetchData(activeTab)}
                  loading={loading}
                  disabled={!sessionActive}
                >
                  Fetch Data
                </Button>
              </Group>

              {loading && (
                <Group justify="center" p="md">
                  <Loader size="md" />
                  <Text size="sm" c="dimmed">
                    Extracting {activeTab} data from TMX PowerStream...
                  </Text>
                </Group>
              )}

              {data && !loading && (
                <Stack gap="md">
                  {/* Structured Data Display */}
                  {renderDataTable()}
                  
                  {/* Raw Data Display */}
                  <ScrollArea h={300}>
                    <JsonInput
                      label="Raw Response Data"
                      value={JSON.stringify(data, null, 2)}
                      readOnly
                      autosize
                      minRows={10}
                    />
                  </ScrollArea>
                </Stack>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Card>
  );
}