'use client';

import { useState } from 'react';
import { Container, Title, Select, Button, Paper, Text, ScrollArea, Code, Group, Alert } from '@mantine/core';
import { notifications } from '@mantine/notifications';

export default function MarketExplorerPage() {
  const [sessionId, setSessionId] = useState<string>('');
  const [selectedExchange, setSelectedExchange] = useState<string>('NYSE');
  const [selectedStat, setSelectedStat] = useState<string>('pl');
  const [loading, setLoading] = useState(false);
  const [marketData, setMarketData] = useState<any>(null);

  const exchanges = [
    { value: 'NYSE', label: 'NYSE - New York Stock Exchange' },
    { value: 'AMX', label: 'AMX - NYSE American (Currently Working)' },
    { value: 'NASDAQ', label: 'NASDAQ - NASDAQ Stock Market' },
    { value: 'TSX', label: 'TSX - Toronto Stock Exchange' },
    { value: 'TSXV', label: 'TSXV - TSX Venture' },
    { value: 'OTC', label: 'OTC - Over-the-Counter' },
    { value: 'LSE', label: 'LSE - London Stock Exchange' },
    { value: 'ASX', label: 'ASX - Australian Securities Exchange' },
  ];

  const statTypes = [
    { value: 'pl', label: 'Price/Volume Leaders' },
    { value: 'ga', label: 'Gainers' },
    { value: 'lo', label: 'Losers' },
    { value: 'ac', label: 'Most Active' },
    { value: 'vo', label: 'Volume Leaders' },
    { value: 'mc', label: 'Market Cap' },
  ];

  const authenticateAndGetSession = async () => {
    try {
      setLoading(true);
      
      // First authenticate with TMX to get session ID
      const authResponse = await fetch('/api/tmx-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userName: process.env.NEXT_PUBLIC_TMX_USERNAME || 'MoltoMario',
          passWord: process.env.NEXT_PUBLIC_TMX_PASSWORD || 'testpassword',
          forward: ''
        }),
      });

      if (!authResponse.ok) {
        throw new Error('Authentication failed');
      }

      const authData = await authResponse.json();
      
      if (!authData.success || !authData.sessionId) {
        throw new Error('Failed to get session ID');
      }

      setSessionId(authData.sessionId);
      notifications.show({
        title: 'Authentication Success',
        message: `Session ID: ${authData.sessionId}`,
        color: 'green',
      });

    } catch (error) {
      console.error('Authentication error:', error);
      notifications.show({
        title: 'Authentication Failed',
        message: 'Could not authenticate with TMX PowerStream',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const exploreMarket = async () => {
    if (!sessionId) {
      notifications.show({
        title: 'Session Required',
        message: 'Please authenticate first to get a session ID',
        color: 'orange',
      });
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch(`/api/explore-markets?sessionId=${sessionId}&exchange=${selectedExchange}&stat=${selectedStat}`);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      setMarketData(data);
      
      notifications.show({
        title: 'Market Data Retrieved',
        message: `Found ${data.symbolCount} symbols from ${selectedExchange}`,
        color: 'blue',
      });

    } catch (error) {
      console.error('Market exploration error:', error);
      notifications.show({
        title: 'Exploration Failed',
        message: 'Could not retrieve market data',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="xl" py="xl">
      <Title order={1} mb="xl">Market Explorer</Title>
      <Text c="dimmed" mb="xl">
        Explore different market exchanges and data types from QuoteMedia API
      </Text>

      <Paper p="md" mb="xl">
        <Group mb="md">
          <Button 
            onClick={authenticateAndGetSession}
            loading={loading}
            disabled={!!sessionId}
          >
            {sessionId ? 'Authenticated' : 'Authenticate & Get Session'}
          </Button>
          {sessionId && (
            <Text size="sm" c="green">
              Session ID: {sessionId.substring(0, 8)}...
            </Text>
          )}
        </Group>

        <Group mb="md">
          <Select
            label="Exchange"
            placeholder="Select exchange"
            value={selectedExchange}
            onChange={(value) => setSelectedExchange(value || 'NYSE')}
            data={exchanges}
            w={300}
          />
          <Select
            label="Data Type"
            placeholder="Select data type"
            value={selectedStat}
            onChange={(value) => setSelectedStat(value || 'pl')}
            data={statTypes}
            w={300}
          />
        </Group>

        <Button 
          onClick={exploreMarket}
          loading={loading}
          disabled={!sessionId}
        >
          Explore Market Data
        </Button>
      </Paper>

      {marketData && (
        <Paper p="md">
          <Title order={3} mb="md">
            {marketData.requestedExchange} - {marketData.statDescription}
          </Title>
          
          <Alert mb="md" color="blue">
            <Text><strong>Symbols Found:</strong> {marketData.symbolCount}</Text>
            <Text><strong>Requested Exchange:</strong> {marketData.requestedExchange}</Text>
            <Text><strong>Data Type:</strong> {marketData.statDescription}</Text>
          </Alert>

          {marketData.symbolCount > 0 && (
            <>
              <Title order={4} mb="sm">Sample Data Structure:</Title>
              <ScrollArea h={400}>
                <Code block>
                  {JSON.stringify(marketData.data[0], null, 2)}
                </Code>
              </ScrollArea>

              <Title order={4} mt="md" mb="sm">First 10 Symbols:</Title>
              <ScrollArea h={300}>
                {marketData.data.slice(0, 10).map((item: any, index: number) => (
                  <Paper key={index} p="sm" mb="sm" withBorder>
                    <Group>
                      <Text fw={700}>{item.key?.symbol}</Text>
                      <Text>{item.equityinfo?.longname || item.equityinfo?.shortname}</Text>
                      <Text c="blue">${item.pricedata?.last}</Text>
                      <Text c={item.pricedata?.changepercent > 0 ? 'green' : 'red'}>
                        {item.pricedata?.changepercent?.toFixed(2)}%
                      </Text>
                    </Group>
                  </Paper>
                ))}
              </ScrollArea>
            </>
          )}
        </Paper>
      )}
    </Container>
  );
}