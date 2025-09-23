'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  Container, 
  Title, 
  Paper, 
  Grid, 
  Stack, 
  Group, 
  Badge, 
  Table,
  Text,
  Button,
  Anchor,
  Loader,
  Alert
} from '@mantine/core';
import { 
  IconArrowLeft, 
  IconBuilding, 
  IconNews, 
  IconFileText,
  IconAlertCircle 
} from '@tabler/icons-react';
import Link from 'next/link';

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

export default function SymbolPage() {
  const params = useParams();
  const ticker = params.ticker as string;
  const [data, setData] = useState<SymbolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticker) return;

    const fetchSymbolData = async () => {
      try {
        const response = await fetch('/api/symbols', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ symbol: ticker }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch symbol data');
        }

        setData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchSymbolData();
  }, [ticker]);

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Group justify="center">
          <Loader size="lg" />
          <Text>Loading {ticker?.toUpperCase()} data...</Text>
        </Group>
      </Container>
    );
  }

  if (error || !data) {
    return (
      <Container size="xl" py="xl">
        <Stack gap="md">
          <Button
            component={Link}
            href="/"
            leftSection={<IconArrowLeft size={16} />}
            variant="light"
            w="fit-content"
          >
            Back to Dashboard
          </Button>
          
          <Alert variant="light" color="red" icon={<IconAlertCircle size={16} />}>
            {error || 'No data available'}
          </Alert>
        </Stack>
      </Container>
    );
  }

  const executiveRows = data.executives.executives.map((exec, index) => (
    <Table.Tr key={index}>
      <Table.Td>{exec.name}</Table.Td>
      <Table.Td>{exec.title}</Table.Td>
    </Table.Tr>
  ));

  const newsRows = data.news.map((article, index) => (
    <Table.Tr key={index}>
      <Table.Td>{article.time}</Table.Td>
      <Table.Td>
        <Anchor href={article.link} target="_blank" size="sm">
          📰 View Article
        </Anchor>
      </Table.Td>
      <Table.Td>
        <Text size="sm" lineClamp={2}>
          {article.title}
        </Text>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Group gap="md">
            <Button
              component={Link}
              href="/"
              leftSection={<IconArrowLeft size={16} />}
              variant="light"
            >
              Back to Dashboard
            </Button>
            <Title order={1} c="blue">
              {data.symbol} Analysis
            </Title>
          </Group>
          
          <Group gap="xs">
            <Badge variant="light" color={data.isEtfEtn === 'YES' ? 'orange' : 'gray'}>
              {data.isEtfEtn === 'YES' ? 'ETF/ETN' : 'Stock'}
            </Badge>
            <Badge variant="light" color="blue">
              {data.executives.country}
            </Badge>
          </Group>
        </Group>

        {/* Main Content Grid */}
        <Grid>
          {/* Left Column - Basic Info */}
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack gap="md">
              {/* Price Info */}
              <Paper shadow="sm" p="md" radius="md">
                <Title order={3} mb="md" c="green">
                  📊 Price Information
                </Title>
                <Table>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Td><Text fw={500}>Symbol</Text></Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="blue" size="lg">
                          {data.symbol}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td><Text fw={500}>Premarket Low</Text></Table.Td>
                      <Table.Td>
                        <Text c={data.premarketLow ? 'blue' : 'dimmed'}>
                          {data.premarketLow || 'N/A'}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td><Text fw={500}>Previous Close</Text></Table.Td>
                      <Table.Td>
                        <Text c={data.previousClose ? 'blue' : 'dimmed'}>
                          {data.previousClose || 'N/A'}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td><Text fw={500}>Profile Link</Text></Table.Td>
                      <Table.Td>
                        <Anchor 
                          href={`https://finance.yahoo.com/quote/${data.symbol}/profile`}
                          target="_blank"
                        >
                          Yahoo Finance Profile
                        </Anchor>
                      </Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              </Paper>

              {/* SEC Filings */}
              <Paper shadow="sm" p="md" radius="md">
                <Title order={3} mb="md" c="orange">
                  <Group gap="xs">
                    <IconFileText size={20} />
                    SEC Filings
                  </Group>
                </Title>
                <Text size="sm">
                  {data.secFiling}
                </Text>
              </Paper>
            </Stack>
          </Grid.Col>

          {/* Right Column - Executives */}
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper shadow="sm" p="md" radius="md" h="100%">
              <Title order={3} mb="md" c="purple">
                <Group gap="xs">
                  <IconBuilding size={20} />
                  Leadership Team
                </Group>
              </Title>
              
              {data.executives.executives.length === 0 ? (
                <Text c="dimmed" ta="center" py="md">
                  No executive information available
                </Text>
              ) : (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Title</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>{executiveRows}</Table.Tbody>
                </Table>
              )}
            </Paper>
          </Grid.Col>
        </Grid>

        {/* News Section */}
        <Paper shadow="sm" p="md" radius="md">
          <Title order={3} mb="md" c="teal">
            <Group gap="xs">
              <IconNews size={20} />
              Recent News ({data.news.length})
            </Group>
          </Title>
          
          {data.news.length === 0 ? (
            <Text c="dimmed" ta="center" py="md">
              No recent news available
            </Text>
          ) : (
            <Table.ScrollContainer minWidth={600}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Time</Table.Th>
                    <Table.Th>Link</Table.Th>
                    <Table.Th>Title</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{newsRows}</Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Paper>
      </Stack>
    </Container>
  );
}
