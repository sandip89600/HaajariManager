import React, { createContext, useContext, useState, PropsWithChildren } from "react";
import {
  GlobalErrorFeedbackModal,
  ErrorReportConfig,
} from "@/components/GlobalErrorFeedbackModal";

interface ErrorFeedbackContextType {
  reportError: (config: ErrorReportConfig) => void;
  closeErrorFeedback: () => void;
}

const ErrorFeedbackContext = createContext<ErrorFeedbackContextType>({
  reportError: () => {},
  closeErrorFeedback: () => {},
});

export function ErrorFeedbackProvider({ children }: PropsWithChildren) {
  const [modalConfig, setModalConfig] = useState<ErrorReportConfig | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const reportError = (config: ErrorReportConfig) => {
    setModalConfig(config);
    setIsModalVisible(true);
  };

  const closeErrorFeedback = () => {
    setIsModalVisible(false);
    setModalConfig(null);
  };

  return (
    <ErrorFeedbackContext.Provider value={{ reportError, closeErrorFeedback }}>
      {children}
      <GlobalErrorFeedbackModal
        visible={isModalVisible}
        config={modalConfig}
        onClose={closeErrorFeedback}
      />
    </ErrorFeedbackContext.Provider>
  );
}

export function useErrorFeedback() {
  return useContext(ErrorFeedbackContext);
}
