import React, { useMemo } from "react";
import { Linking, StyleSheet, Text, type TextProps, type TextStyle } from "react-native";

const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?'"')\]}>])/gi;

type Props = TextProps & {
  children: string;
  linkStyle?: TextStyle;
};

function normalizeUrl(url: string) {
  return url.startsWith("www.") ? `https://${url}` : url;
}

export function LinkableText({ children, style, linkStyle, ...rest }: Props) {
  const parts = useMemo(() => {
    const segments: Array<{ text: string; href?: string }> = [];
    let lastIndex = 0;
    const matches = children.matchAll(URL_PATTERN);

    for (const match of matches) {
      const value = match[0];
      const index = match.index ?? 0;
      if (index > lastIndex) {
        segments.push({ text: children.slice(lastIndex, index) });
      }
      segments.push({ text: value, href: normalizeUrl(value) });
      lastIndex = index + value.length;
    }

    if (lastIndex < children.length) {
      segments.push({ text: children.slice(lastIndex) });
    }

    return segments.length ? segments : [{ text: children }];
  }, [children]);

  return (
    <Text style={style} {...rest}>
      {parts.map((part, index) =>
        part.href ? (
          <Text
            key={`${part.href}-${index}`}
            style={[styles.link, linkStyle]}
            onPress={() => void Linking.openURL(part.href!)}
          >
            {part.text}
          </Text>
        ) : (
          <Text key={`${part.text}-${index}`}>{part.text}</Text>
        ),
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: {
    textDecorationLine: "underline",
  },
});
