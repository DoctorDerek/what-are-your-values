import { introductionCopy } from "@game/data/src/IntroductionCopy"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import MapacheButton from "@/components/MapacheButton"
import MapachePanel from "@/components/MapachePanel"
import MapacheScreen from "@/components/MapacheScreen"
import {
  mapacheColors,
  mapacheLayout,
  mapacheSpacing,
} from "@/theme/MapacheVividTheme"

export default function NativeSplash({
  announcement,
  onComplete,
}: {
  readonly announcement?: string | null
  readonly onComplete: () => void
}) {
  return (
    <MapacheScreen>
      <ScrollView
        alwaysBounceVertical={false}
        contentContainerStyle={styles.content}
      >
        <Text accessibilityRole="header" style={styles.title}>
          {introductionCopy.title}
        </Text>
        <MapachePanel>
          {announcement ? (
            <View
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              style={styles.announcement}
            >
              <Text style={styles.announcementText}>{announcement}</Text>
            </View>
          ) : null}
          <Text style={styles.tagline}>{introductionCopy.tagline}</Text>
          {introductionCopy.body.map((paragraph) => (
            <Text key={paragraph} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
          <MapacheButton
            label={introductionCopy.startAction}
            onPress={onComplete}
          />
        </MapachePanel>
      </ScrollView>
    </MapacheScreen>
  )
}

const styles = StyleSheet.create({
  announcement: {
    backgroundColor: mapacheColors.green,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    marginBottom: mapacheSpacing.spacious,
    padding: mapacheSpacing.standard,
  },
  announcementText: {
    color: mapacheColors.white,
    fontSize: 18,
    fontWeight: "900",
  },
  content: {
    gap: mapacheSpacing.spacious,
    paddingBottom: mapacheLayout.panelShadowOffset,
  },
  paragraph: {
    color: mapacheColors.charcoal,
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 27,
    marginBottom: mapacheSpacing.standard,
  },
  tagline: {
    color: mapacheColors.black,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 34,
    marginBottom: mapacheSpacing.spacious,
  },
  title: {
    color: mapacheColors.cyan,
    fontSize: 42,
    fontWeight: "900",
    lineHeight: 46,
    textAlign: "center",
    textTransform: "uppercase",
  },
})
