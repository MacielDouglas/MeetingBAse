import { useEffect, Component, type ReactNode } from "react";
import { View, Text, Button } from "react-native";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 16 }}>
          <Text style={{ fontSize: 20, fontWeight: "bold", textAlign: "center" }}>
            Algo salió mal
          </Text>
          <Text style={{ textAlign: "center", color: "#666" }}>
            {this.state.error?.message ?? "Error desconocido"}
          </Text>
          <Button
            title="Reintentar"
            onPress={() => this.setState({ hasError: false, error: null })}
          />
        </View>
      );
    }
    return this.props.children;
  }
}
