'use client';

import { useState, useEffect } from 'react';
import { 
  Stack, 
  Title, 
  Group, 
  Badge, 
  Table,
  Text,
  Button,
  Anchor,
  Loader,
  Alert,
  Paper,
  Grid,
  Center,
  Box
} from '@mantine/core';
import { 
  IconBuilding, 
  IconNews, 
  IconFileText,
  IconAlertCircle,
  IconRefresh,
  IconArrowLeft
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import RealTimeQuotes from './RealTimeQuotes';

interface SymbolData {
  symbol: string;
  executives: {
    country: string;
    executives: Array<{ name: string; title: string }>;
  };
  premarketLow: string | null;
  previousClose: number;
  isEtfEtn: string;
  news: Array<{ title: string; link: string; time: string }>;
  secFiling: string;
}

interface SymbolAnalysisProps {
  symbol: string;
  onBackToHome?: () => void;
}

export function SymbolAnalysis({ symbol, onBackToHome }: SymbolAnalysisProps) {
  const [data, setData] = useState<SymbolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSymbolData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/symbols', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbol }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch symbol data');
      }

      setData(result.data);
      
      notifications.show({
        title: 'Symbol Loaded',
        message: `Analysis for ${symbol} loaded successfully`,
        color: 'green',
        autoClose: 3000,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      
      notifications.show({
        title: 'Error',
        message: `Failed to load ${symbol}: ${errorMessage}`,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSymbolData();
  }, [symbol]);

  if (loading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text>Loading {symbol} analysis...</Text>
      </Stack>
    );
  }

  if (error || !data) {
    return (
      <Stack gap="md">
        <Alert variant="light" color="red" icon={<IconAlertCircle size={16} />}>
          {error || 'No data available'}
        </Alert>
        <Button leftSection={<IconRefresh size={16} />} onClick={fetchSymbolData}>
          Retry
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap="md" p="md">
      {/* Header with Back Button */}
      <Group justify="space-between" align="center" mb="md">
        <Group gap="md">
          {onBackToHome && (
            <Button
              variant="light"
              size="sm"
              leftSection={<IconArrowLeft size={16} />}
              onClick={onBackToHome}
            >
              Back to Home
            </Button>
          )}
          <Title order={2} c="teal">
            📈 {data.symbol} Analysis
          </Title>
        </Group>
        
        <Button
          variant="light"
          size="sm"
          leftSection={<IconRefresh size={14} />}
          onClick={fetchSymbolData}
          loading={loading}
        >
          Refresh
        </Button>
      </Group>

      {/* Real-Time Quote Section */}
      <RealTimeQuotes symbol={data.symbol} />

      {/* Main Summary Table - Google Sheets Style */}
      <Paper shadow="sm" p={0} radius="md" withBorder>
        <Table highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr style={{ backgroundColor: '#90EE90' }}>
              <Table.Th style={{ backgroundColor: '#90EE90', fontWeight: 'bold', textAlign: 'center' }}>
                Symbol
              </Table.Th>
              <Table.Th style={{ backgroundColor: '#90EE90', fontWeight: 'bold', textAlign: 'center' }}>
                PML
              </Table.Th>
              <Table.Th style={{ backgroundColor: '#90EE90', fontWeight: 'bold', textAlign: 'center' }}>
                Country
              </Table.Th>
              <Table.Th style={{ backgroundColor: '#ADD8E6', fontWeight: 'bold', textAlign: 'center' }}>
                ETF/ETN
              </Table.Th>
              <Table.Th style={{ backgroundColor: '#90EE90', fontWeight: 'bold', textAlign: 'center' }}>
                Link
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td style={{ fontWeight: 'bold', textAlign: 'center' }}>
                {data.symbol}
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div>

                    <Text fw={600}>{data.premarketLow || 'N/A'}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">PREV CLOSE</Text>
                    <Text fw={500}>{data.previousClose || 'N/A'}</Text>
                  </div>
                </div>
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                {data.executives.country}
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                <Badge 
                  variant="filled" 
                  color={data.isEtfEtn === 'YES' ? 'orange' : 'blue'}
                  size="sm"
                >
                  {data.isEtfEtn === 'YES' ? 'YES' : 'NO'}
                </Badge>
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                <Anchor 
                  href={`https://finance.yahoo.com/quote/${data.symbol}/profile`}
                  target="_blank"
                  size="sm"
                >
                  Yahoo Profile
                </Anchor>
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Paper>

      {/* CEO/Executives Table */}
      <Paper shadow="sm" p={0} radius="md" withBorder>
        <Table highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr style={{ backgroundColor: '#90EE90' }}>
              <Table.Th style={{ backgroundColor: '#90EE90', fontWeight: 'bold', width: '40%' }}>
                CEO Name
              </Table.Th>
              <Table.Th style={{ backgroundColor: '#90EE90', fontWeight: 'bold', width: '60%' }}>
                Title
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.executives.executives.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={2} style={{ textAlign: 'center', fontStyle: 'italic', color: '#666' }}>
                  No executive information available
                </Table.Td>
              </Table.Tr>
            ) : (
              data.executives.executives.map((exec, index) => (
                <Table.Tr key={index}>
                  <Table.Td style={{ fontWeight: '500' }}>
                    {exec.name}
                  </Table.Td>
                  <Table.Td>
                    {exec.title}
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Corporate Actions & SEC Filings */}
      <Paper shadow="sm" p={0} radius="md" withBorder>
        <Table highlightOnHover withTableBorder withColumnBorders>
          <Table.Tbody>
            <Table.Tr style={{ backgroundColor: '#90EE90' }}>
              <Table.Td style={{ backgroundColor: '#90EE90', fontWeight: 'bold', textAlign: 'center' }}>
                Corporate Actions
              </Table.Td>
              <Table.Td>
                No corporate actions found in the last 3 market days
              </Table.Td>
            </Table.Tr>
            <Table.Tr style={{ backgroundColor: '#90EE90' }}>
              <Table.Td style={{ backgroundColor: '#90EE90', fontWeight: 'bold', textAlign: 'center' }}>
                SEC Filings
              </Table.Td>
              <Table.Td>
                {data.secFiling}
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Recent News Table */}
      <Paper shadow="sm" p={0} radius="md" withBorder>
        <Table highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr style={{ backgroundColor: '#90EE90' }}>
              <Table.Th colSpan={3} style={{ backgroundColor: '#90EE90', fontWeight: 'bold', textAlign: 'center' }}>
                RECENT NEWS
              </Table.Th>
            </Table.Tr>
            <Table.Tr style={{ backgroundColor: '#90EE90' }}>
              <Table.Th style={{ backgroundColor: '#90EE90', fontWeight: 'bold', width: '15%' }}>
                Time
              </Table.Th>
              <Table.Th style={{ backgroundColor: '#90EE90', fontWeight: 'bold', width: '10%' }}>
                Link
              </Table.Th>
              <Table.Th style={{ backgroundColor: '#90EE90', fontWeight: 'bold', width: '75%' }}>
                Title
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.news.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={3} style={{ textAlign: 'center', fontStyle: 'italic', color: '#666' }}>
                  No recent news available
                </Table.Td>
              </Table.Tr>
            ) : (
              data.news.map((article, index) => (
                <Table.Tr key={index}>
                  <Table.Td style={{ fontSize: '0.875rem' }}>
                    {article.time}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Anchor href={article.link} target="_blank" size="xs">
                      📰
                    </Anchor>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {article.title}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>
    </Stack>
  );
}
