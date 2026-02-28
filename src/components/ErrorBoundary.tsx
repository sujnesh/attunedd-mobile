import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>SOMETHING WENT WRONG</Text>
          <Text style={styles.message}>
            {this.state.error?.message ?? 'An unexpected error occurred'}
          </Text>
          <Pressable onPress={this.handleRetry} style={styles.retryBtn}>
            <Text style={styles.retryText}>RETRY</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    color: '#E74C3C',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
    fontFamily: MONO,
    marginBottom: 16,
  },
  message: {
    color: '#888888',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  retryBtn: {
    borderWidth: 0.5,
    borderColor: '#333333',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  retryText: {
    color: '#EAEAEA',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    fontFamily: MONO,
  },
});
