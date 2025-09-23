'use client';

import { useState } from 'react';
import { TextInput, Button, Stack, Title, Alert } from '@mantine/core';
import { IconPlus, IconSearch, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface SymbolInputProps {
  onSymbolAdded: (symbol: string) => void;
}

export function SymbolInput({ onSymbolAdded }: SymbolInputProps) {
  const [symbol, setSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedSymbol = symbol.trim().toUpperCase();
    if (!trimmedSymbol) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/symbols', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbol: trimmedSymbol }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add symbol');
      }

      onSymbolAdded(trimmedSymbol);
      setSymbol('');
      
      notifications.show({
        title: 'Success',
        message: `${trimmedSymbol} added successfully!`,
        color: 'green',
        icon: <IconPlus size={16} />,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      
      notifications.show({
        title: 'Error',
        message: errorMessage,
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap="md">
      <Title order={3} c="blue">📈 Add Stock Symbol</Title>
      
      {error && (
        <Alert variant="light" color="red" icon={<IconAlertCircle size={16} />}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <TextInput
            placeholder="Enter stock symbol (e.g. AAPL)"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            leftSection={<IconSearch size={16} />}
            size="md"
            disabled={loading}
          />
          
          <Button
            type="submit"
            loading={loading}
            leftSection={<IconPlus size={16} />}
            fullWidth
            size="md"
          >
            Add Symbol
          </Button>
        </Stack>
      </form>
    </Stack>
  );
}
