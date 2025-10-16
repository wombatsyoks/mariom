'use client';

import { Container, Title, Stack, Paper, Text, Group, Badge } from '@mantine/core';
import TMXRealtimeStream from '@/components/TMXRealtimeStream';

export default function TMXStreamTestPage() {
  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <Paper withBorder p="md">
          <Group justify="center">
            <Title order={1}>TMX PowerStream Real-time Data</Title>
            <Badge color="blue" variant="light" size="lg">
              Live Market Data Streaming
            </Badge>
          </Group>
          <Text ta="center" c="dimmed" mt="sm">
            Real-time market data streaming using TMX PowerStream authentication
          </Text>
        </Paper>

        <TMXRealtimeStream 
          defaultSymbols={['AAPL', 'TSLA', 'GOOGL', 'MSFT', 'NVDA', 'SHOP.TO', 'TD.TO']}
          refreshInterval={3000}
          autoStart={true}
        />
      </Stack>
    </Container>
  );
}