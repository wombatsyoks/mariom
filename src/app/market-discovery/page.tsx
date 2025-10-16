'use client';

import { useState } from 'react';
import { Container, Title, Select, Button, Paper, Text, ScrollArea, Code, Group, Alert, Tabs, Badge } from '@mantine/core';
import { notifications } from '@mantine/notifications';

export default function MarketDiscoveryPage() {
  const [sessionId, setSessionId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [discoveryResults, setDiscoveryResults] = useState<any>(null);

  const authenticateAndGetSession = async () => {
    try {
      setLoading(true);
      
      const authResponse = await fetch('/api/tmx-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userName: 'MoltoMario',
          passWord: 'testpassword',
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

  const runDiscovery = async (testType: string) => {
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
      
      const response = await fetch(`/api/market-discovery?sessionId=${sessionId}&testType=${testType}`);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      setDiscoveryResults(data);
      
      notifications.show({
        title: 'Discovery Complete',
        message: `Found ${data.summary.successfulTests} working configurations out of ${data.summary.totalTests}`,
        color: data.summary.successfulTests > 0 ? 'green' : 'yellow',
      });

    } catch (error) {
      console.error('Discovery error:', error);
      notifications.show({
        title: 'Discovery Failed',
        message: 'Could not run market discovery',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="xl" py="xl">
      <Title order={1} mb="xl">🔬 Market Discovery Lab</Title>
      <Text c="dimmed" mb="xl">
        Advanced testing to discover alternative APIs and parameters for different market data
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
          <Button 
            onClick={() => runDiscovery('endpoints')}
            loading={loading}
            disabled={!sessionId}
            variant="outline"
          >
            🔗 Test API Endpoints
          </Button>
          <Button 
            onClick={() => runDiscovery('parameters')}
            loading={loading}
            disabled={!sessionId}
            variant="outline"
          >
            📊 Test Parameters
          </Button>
          <Button 
            onClick={() => runDiscovery('sessions')}
            loading={loading}
            disabled={!sessionId}
            variant="outline"
          >
            🕒 Test Market Sessions
          </Button>
        </Group>
      </Paper>

      {discoveryResults && (
        <Paper p="md">
          <Title order={3} mb="md">
            Discovery Results - {discoveryResults.testType.toUpperCase()}
          </Title>
          
          <Alert mb="md" color="blue">
            <Group>
              <Text><strong>Total Tests:</strong> {discoveryResults.summary.totalTests}</Text>
              <Badge color="green">✅ Success: {discoveryResults.summary.successfulTests}</Badge>
              <Badge color="red">❌ Failed: {discoveryResults.summary.failedTests}</Badge>
              <Badge color="blue">📊 With Data: {discoveryResults.summary.withData}</Badge>
            </Group>
          </Alert>

          {discoveryResults.recommendations && discoveryResults.recommendations.length > 0 && (
            <Alert mb="md" color="teal" title="Recommendations">
              {discoveryResults.recommendations.map((rec: any, index: number) => (
                <Text key={index} size="sm">{rec.message}</Text>
              ))}
            </Alert>
          )}

          <Tabs defaultValue="successful">
            <Tabs.List>
              <Tabs.Tab value="successful">✅ Successful Tests</Tabs.Tab>
              <Tabs.Tab value="failed">❌ Failed Tests</Tabs.Tab>
              <Tabs.Tab value="all">📋 All Results</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="successful">
              <ScrollArea h={500}>
                {discoveryResults.discoveries
                  .filter((d: any) => d.success)
                  .map((discovery: any, index: number) => (
                    <Paper key={index} p="sm" mb="sm" withBorder>
                      <Group mb="xs">
                        <Badge color="green">✅ SUCCESS</Badge>
                        <Text fw={600}>
                          {discovery.endpoint || discovery.parameterSet || discovery.marketSession}
                        </Text>
                        {discovery.symbolCount !== undefined && (
                          <Badge variant="light">{discovery.symbolCount} symbols</Badge>
                        )}
                      </Group>
                      
                      {discovery.exchanges && discovery.exchanges.length > 0 && (
                        <Text size="sm" c="blue">
                          Exchanges: {discovery.exchanges.join(', ')}
                        </Text>
                      )}
                      
                      {discovery.parameters && (
                        <Code block mt="xs" fz="xs">
                          {JSON.stringify(discovery.parameters, null, 2)}
                        </Code>
                      )}
                      
                      {discovery.rawPreview && (
                        <Text size="xs" c="dimmed" mt="xs">
                          Response: {discovery.rawPreview}...
                        </Text>
                      )}
                    </Paper>
                  ))}
              </ScrollArea>
            </Tabs.Panel>

            <Tabs.Panel value="failed">
              <ScrollArea h={500}>
                {discoveryResults.discoveries
                  .filter((d: any) => !d.success)
                  .map((discovery: any, index: number) => (
                    <Paper key={index} p="sm" mb="sm" withBorder>
                      <Group mb="xs">
                        <Badge color="red">❌ FAILED</Badge>
                        <Text fw={600}>
                          {discovery.endpoint || discovery.parameterSet || discovery.marketSession}
                        </Text>
                        {discovery.status && (
                          <Badge variant="light" color="orange">HTTP {discovery.status}</Badge>
                        )}
                      </Group>
                      
                      {discovery.error && (
                        <Text size="sm" c="red">
                          Error: {discovery.error}
                        </Text>
                      )}
                      
                      {discovery.rawPreview && (
                        <Text size="xs" c="dimmed" mt="xs">
                          Response: {discovery.rawPreview}...
                        </Text>
                      )}
                    </Paper>
                  ))}
              </ScrollArea>
            </Tabs.Panel>

            <Tabs.Panel value="all">
              <ScrollArea h={500}>
                <Code block>
                  {JSON.stringify(discoveryResults, null, 2)}
                </Code>
              </ScrollArea>
            </Tabs.Panel>
          </Tabs>
        </Paper>
      )}
    </Container>
  );
}