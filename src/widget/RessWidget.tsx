"use no memo";
import React from "react";
import {
  FlexWidget,
  ListWidget,
  ImageWidget,
  SvgWidget,
  TextWidget,
  type ImageWidgetSource,
} from "react-native-android-widget";
import { Article, relativeTime, isGitHubRelease } from "../data/feeds";
import { theme, colorsFor } from "../ui/theme";
export function RessWidget({
  articles,
  width = 300,
  synced,
  failed = false,
  refreshing = false,
  scheme = "light",
}: {
  articles: Article[];
  width?: number;
  height?: number;
  synced: string;
  failed?: boolean;
  refreshing?: boolean;
  scheme?: "light" | "dark";
}) {
  "use no memo";
  const c = colorsFor(scheme);
  const contentWidth = Math.max(0, width - 32);
  // Keep the title legible and reserve the full refresh hit area at every width.
  const statusWidth = Math.max(0, Math.min(96, contentWidth - 120));
  const thumbnailWidth = Math.max(48, Math.min(96, Math.floor(contentWidth * 0.36)));
  const visibleArticles = articles.slice(0, 10);
  return (
    <FlexWidget
      style={{
        width: "match_parent",
        height: "match_parent",
        backgroundColor: scheme === "dark" ? c.paper : c.yellowSoft,
        borderRadius: 24,
        padding: 16,
      }}
    >
      <FlexWidget
        style={{
          width: "match_parent",
          height: 40,
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <FlexWidget style={{ width: 0, flex: 1 }}>
          <TextWidget
            text="ress"
            style={{
              fontSize: 30,
              fontFamily: "Vollkorn_600SemiBold",
              color: c.ink,
            }}
            clickAction="OPEN_APP"
          />
        </FlexWidget>
        <TextWidget
          text={
            refreshing ? "Refreshing…" : failed ? "Offline" : synced ? `Updated ${relativeTime(synced)}` : ""
          }
          style={{
            width: statusWidth,
            color: c.muted,
            fontFamily: theme.font.body,
            fontSize: 10,
            marginRight: statusWidth ? 8 : 0,
            textAlign: "right",
          }}
          maxLines={1}
          truncate="END"
        />
        <FlexWidget
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
          clickAction="REFRESH"
          accessibilityLabel="Refresh feeds"
        >
          <SvgWidget
            svg={`<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${c.ink}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>`}
            style={{ width: 22, height: 22 }}
          />
        </FlexWidget>
      </FlexWidget>
      {articles.length ? (
        <FlexWidget style={{ width: "match_parent", height: 0, flex: 1 }}>
          <ListWidget style={{ width: "match_parent", height: "match_parent" }}>
            {visibleArticles.map((a, index) => {
              const release = isGitHubRelease(a.url);
              return (
                <FlexWidget
                  key={a.id}
                  style={{
                    width: "match_parent",
                    paddingVertical: 12,
                    borderBottomWidth: index === visibleArticles.length - 1 ? 0 : 1,
                    borderBottomColor: scheme === "dark" ? "#3A3D31" : "#DDD39B",
                  }}
                  clickAction="OPEN_URI"
                  clickActionData={{
                    uri: `ress://article?id=${encodeURIComponent(a.id)}`,
                  }}
                >
                  <FlexWidget
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    {a.favicon ? (
                      <ImageWidget
                        image={a.favicon as ImageWidgetSource}
                        imageWidth={16}
                        imageHeight={16}
                        radius={8}
                        style={{ marginRight: 6 }}
                      />
                    ) : null}
                    <TextWidget
                      text={a.source}
                      maxLines={1}
                      truncate="END"
                      style={{
                        color: c.muted,
                        fontSize: 11,
                        fontFamily: theme.font.body,
                      }}
                    />
                  </FlexWidget>
                  <FlexWidget
                    style={{
                      width: "match_parent",
                      flexDirection: "row",
                      alignItems: "flex-start",
                    }}
                  >
                    <FlexWidget style={{ width: 0, flex: 1 }}>
                      <TextWidget
                        text={a.title}
                        maxLines={3}
                        truncate="END"
                        style={{
                          color: c.ink,
                          fontSize: 17,
                          fontFamily: theme.font.bold,
                        }}
                      />
                      <TextWidget
                        text={relativeTime(a.date)}
                        style={{ color: c.muted, fontFamily: theme.font.body, fontSize: 10, marginTop: 7 }}
                      />
                    </FlexWidget>
                    {a.image ? (
                      <ImageWidget
                        image={a.image as ImageWidgetSource}
                        imageWidth={release ? 56 : thumbnailWidth}
                        imageHeight={release ? 56 : Math.round(thumbnailWidth * 9 / 16)}
                        radius={8}
                        resizeMode="cover"
                        style={{ marginLeft: 12 }}
                      />
                    ) : null}
                  </FlexWidget>
                </FlexWidget>
              );
            })}
          </ListWidget>
        </FlexWidget>
      ) : (
        <TextWidget
          text="No articles here yet. Open Ress to add or refresh your sources."
          style={{ color: c.ink, fontSize: 16 }}
          clickAction="OPEN_APP"
        />
      )}
    </FlexWidget>
  );
}
