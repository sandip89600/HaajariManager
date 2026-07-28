import React, { createContext, useContext, useState, useEffect } from "react";
import { View, StyleSheet, Dimensions, Pressable, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";

const STORAGE_KEY = "@haajari/onboarding_completed";
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export interface TourStep {
  title: string;
  description: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: "👋 Welcome",
    description: "Haajari Manager mein aapka swagat hai.\nChaliye 2 minute mein app use karna seekhte hain.",
  },
  {
    title: "🏠 Dashboard",
    description: "Yahan se aap poori company ki jankari dekh sakte hain.\nKitne worker aaye, kitni site chal rahi hai aur aaj ka kaam.",
  },
  {
    title: "👷 Workers",
    description: "Yahan apne mazdoor add karein.\nHar worker ki attendance aur payment yahin se manage hogi.",
  },
  {
    title: "📅 Attendance",
    description: "Roz subah yahan attendance lagaiye.\nEk tap se Present, Absent ya Half Day mark karein.",
  },
  {
    title: "🏗 Site",
    description: "Yahan nayi site banaiye.\nHar site par workers, materials aur progress dekh sakte hain.",
  },
  {
    title: "🧱 Materials",
    description: "Site par kitna cement, steel aur doosra saman aaya aur kitna use hua.\nSab record yahin rakhiye.",
  },
  {
    title: "📷 Photos",
    description: "Kaam shuru hone se pehle aur kaam khatam hone ke baad photo upload karein.\nIsse progress ka record hamesha safe rahega.",
  },
  {
    title: "💰 Payments",
    description: "Worker ko kitna paisa diya aur kitna baaki hai.\nSab payment ka hisaab yahin milega.",
  },
  {
    title: "📊 Reports",
    description: "Ek click mein PDF aur Excel report banaiye.\nClient ya office ke saath aasani se share karein.",
  },
  {
    title: "🤖 Ask HAI",
    description: "Kuch samajh na aaye?\nAsk HAI se seedha sawaal poochiye.",
  },
  {
    title: "🎉 You're Ready",
    description: "Ab aap Haajari Manager use karne ke liye taiyar hain.\nChaliye pehli site banate hain.",
  },
];

interface TourContextType {
  isActive: boolean;
  currentStep: number;
  startTour: () => void;
  stopTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  registerTarget: (stepIndex: number, ref: React.RefObject<any>) => void;
}

const TourContext = createContext<TourContextType | null>(null);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targets, setTargets] = useState<{ [key: number]: { x: number; y: number; w: number; h: number } }>({});

  useEffect(() => {
    // Check if first-time user
    AsyncStorage.getItem(STORAGE_KEY).then((completed) => {
      if (!completed) {
        setTimeout(() => {
          setIsActive(true);
        }, 1500);
      }
    });
  }, []);

  const startTour = () => {
    setCurrentStep(0);
    setIsActive(true);
  };

  const stopTour = async () => {
    setIsActive(false);
    await AsyncStorage.setItem(STORAGE_KEY, "true");
  };

  const nextStep = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      stopTour();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const registerTarget = (stepIndex: number, ref: React.RefObject<any>) => {
    if (!ref.current) return;
    setTimeout(() => {
      ref.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
        if (width > 0 && height > 0) {
          setTargets((prev) => ({
            ...prev,
            [stepIndex]: { x, y, w: width, h: height },
          }));
        }
      });
    }, 400);
  };

  // Map step index to mapped coordinate ref if needed
  // Many dashboard widgets can reuse the same layout refs to point correctly
  let stepTargetIndex = currentStep;
  if (currentStep === 1) stepTargetIndex = 1; // Dashboard header summary
  if (currentStep === 2) stepTargetIndex = 3; // Workers add button
  if (currentStep === 3) stepTargetIndex = 2; // Attendance log header
  if (currentStep === 4) stepTargetIndex = 3; // Site add button
  if (currentStep === 5) stepTargetIndex = 3; // Materials (secondary buttons grid)
  if (currentStep === 6) stepTargetIndex = 2; // Photos log
  if (currentStep === 7) stepTargetIndex = 2; // Payments log
  if (currentStep === 8) stepTargetIndex = 3; // Reports view button
  if (currentStep === 9) stepTargetIndex = 0; // Ask HAI (top welcome header area/AI)
  if (currentStep === 10) stepTargetIndex = 0; // You're ready

  const activeTarget = targets[stepTargetIndex];
  const stepInfo = TOUR_STEPS[currentStep];

  // Tooltip position calculations
  let tooltipTop = SCREEN_HEIGHT / 2 - 120;
  let tooltipLeft = 20;
  let tooltipWidth = SCREEN_WIDTH - 40;
  let isBelow = true;

  if (activeTarget) {
    if (activeTarget.y < SCREEN_HEIGHT / 2) {
      tooltipTop = activeTarget.y + activeTarget.h + 20;
      isBelow = true;
    } else {
      tooltipTop = activeTarget.y - 200;
      isBelow = false;
    }
    // Align x-axis to keep card centered
    tooltipLeft = 20;
    tooltipWidth = SCREEN_WIDTH - 40;
  }

  // Pointer position on the tooltip card
  let arrowX = SCREEN_WIDTH / 2 - 20;
  if (activeTarget) {
    arrowX = activeTarget.x + activeTarget.w / 2 - 30;
    // Bounds check to ensure arrow stays within the tooltip card limits
    arrowX = Math.max(30, Math.min(arrowX, SCREEN_WIDTH - 70));
  }

  return (
    <TourContext.Provider
      value={{
        isActive,
        currentStep,
        startTour,
        stopTour,
        nextStep,
        prevStep,
        registerTarget,
      }}
    >
      {children}

      {isActive && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          {activeTarget ? (
            <>
              {/* Highlight backdrop masks */}
              <View
                style={[
                  styles.maskDark,
                  { top: 0, left: 0, width: SCREEN_WIDTH, height: activeTarget.y },
                ]}
              />
              <View
                style={[
                  styles.maskDark,
                  {
                    top: activeTarget.y,
                    left: 0,
                    width: activeTarget.x,
                    height: activeTarget.h,
                  },
                ]}
              />
              <View
                style={[
                  styles.maskDark,
                  {
                    top: activeTarget.y,
                    left: activeTarget.x + activeTarget.w,
                    width: SCREEN_WIDTH - (activeTarget.x + activeTarget.w),
                    height: activeTarget.h,
                  },
                ]}
              />
              <View
                style={[
                  styles.maskDark,
                  {
                    top: activeTarget.y + activeTarget.h,
                    left: 0,
                    width: SCREEN_WIDTH,
                    height: SCREEN_HEIGHT - (activeTarget.y + activeTarget.h),
                  },
                ]}
              />
            </>
          ) : (
            <View style={[styles.maskDark, StyleSheet.absoluteFillObject]} />
          )}

          {/* Pointing Arrow Indicator */}
          {activeTarget && (
            <View
              style={[
                styles.arrow,
                {
                  left: arrowX,
                  top: isBelow ? activeTarget.y + activeTarget.h + 6 : activeTarget.y - 14,
                },
              ]}
            >
              <ThemedText style={[styles.arrowText, { color: theme.primary }]}>
                {isBelow ? "▲" : "▼"}
              </ThemedText>
            </View>
          )}

          {/* Floating Tooltip Card */}
          <View
            style={[
              styles.tooltipCard,
              {
                top: tooltipTop,
                left: tooltipLeft,
                width: tooltipWidth,
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.primary,
              },
            ]}
          >
            <View style={styles.tooltipHeader}>
              <ThemedText style={[styles.tooltipTitle, { color: theme.primary }]}>
                {stepInfo.title}
              </ThemedText>
              <Pressable onPress={stopTour} hitSlop={15} style={styles.closeBtn}>
                <Feather name="x" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ThemedText style={[styles.tooltipDesc, { color: theme.text }]}>
              {stepInfo.description}
            </ThemedText>

            <View style={styles.tooltipActions}>
              <Pressable onPress={stopTour} style={styles.skipBtn} hitSlop={15}>
                <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>
                  Skip Tour
                </ThemedText>
              </Pressable>

              <View style={styles.navigationBtns}>
                {currentStep > 0 && (
                  <Pressable onPress={prevStep} style={styles.prevBtn} hitSlop={15}>
                    <ThemedText style={[styles.prevText, { color: theme.textSecondary }]}>
                      ← Peechhe
                    </ThemedText>
                  </Pressable>
                )}

                <Pressable
                  onPress={nextStep}
                  style={[styles.nextBtn, { backgroundColor: theme.primary }]}
                  hitSlop={15}
                >
                  <ThemedText style={styles.nextText}>
                    {currentStep === TOUR_STEPS.length - 1 ? "Start Karein 🎉" : "Aage Badhein →"}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      )}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return context;
}

const styles = StyleSheet.create({
  maskDark: {
    position: "absolute",
    backgroundColor: "rgba(0, 0, 0, 0.76)",
  },
  arrow: {
    position: "absolute",
    width: 20,
    height: 20,
    zIndex: 999999,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowText: {
    fontSize: 22,
    lineHeight: 22,
  },
  tooltipCard: {
    position: "absolute",
    borderRadius: 18,
    borderWidth: 2,
    padding: 18,
    zIndex: 99999,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  tooltipHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  closeBtn: {
    padding: 2,
  },
  tooltipTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  tooltipDesc: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 22,
    marginBottom: 20,
  },
  tooltipActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  skipBtn: {
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 14,
    fontWeight: "700",
  },
  navigationBtns: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  prevBtn: {
    paddingVertical: 8,
  
  },
  prevText: {
    fontSize: 14,
    fontWeight: "700",
  },
  nextBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  nextText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
