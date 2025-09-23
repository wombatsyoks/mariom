'use client';

import { Table, Title, Button, Badge, Stack, Group, Text, ActionIcon } from '@mantine/core';
import { IconTrash, IconExternalLink } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface SymbolListProps {
  symbols: string[];
  onClearAll: () => void;
  onSymbolClick?: (symbol: string) => void;
  showDetails?: boolean;
}

export function SymbolList({ symbols, onClearAll, onSymbolClick, showDetails = false }: SymbolListProps) {
  const handleClearAll = () => {
    if (symbols.length === 0) return;
    
    if (confirm('Are you sure you want to clear all symbols?')) {
      onClearAll();
      notifications.show({
        title: 'Cleared',
        message: 'All symbols have been removed',
        color: 'orange',
      });
    }
  };

  const rows = symbols.map((symbol, index) => (
    <Table.Tr key={symbol}>
      <Table.Td>
        <Text fw={500}>{index + 1}</Text>
      </Table.Td>
      <Table.Td>
        <Group gap="xs">
          <Badge 
            variant="light" 
            color="green"
            style={{ cursor: onSymbolClick ? 'pointer' : 'default' }}
            onClick={() => onSymbolClick?.(symbol)}
            title={`Click to view ${symbol} details`}
          >
            📈 {symbol}
          </Badge>
          {showDetails && (
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => onSymbolClick?.(symbol)}
              title={`View ${symbol} analysis`}
            >
              <IconExternalLink size={14} />
            </ActionIcon>
          )}
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Title order={3} c="green">📋 Symbol List ({symbols.length})</Title>
        {symbols.length > 0 && (
          <Button
            variant="light"
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={handleClearAll}
            size="sm"
          >
            Clear All
          </Button>
        )}
      </Group>

      {symbols.length === 0 ? (
        <Text ta="center" c="dimmed" py="md">
          No symbols added yet
        </Text>
      ) : (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>#</Table.Th>
              <Table.Th>Symbol</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{rows}</Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
