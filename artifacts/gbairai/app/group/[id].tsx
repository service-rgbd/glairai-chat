import { Feather, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { SearchBar } from "@/components/SearchBar";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthToken } from "@/hooks/useAuthToken";
import type { ComposeContactOption } from "@/contexts/chats-types";
import { useChats } from "@/contexts/chats-context-ref";
import { useColors } from "@/hooks/useColors";
import {
  buildGroupInviteShareMessage,
  getGroupDisplayColor,
  getGroupDisplayInitials,
  getGroupMemberCountLabel,
} from "@/lib/group-utils";
import {
  DEFAULT_GROUP_SETTINGS,
  groupAccessModeLabel,
  type GroupAccessMode,
  type GroupSettings,
} from "@/lib/group-settings";
import {
  createMediaUploadTarget,
  getUploadDisplayUrl,
  uploadFileToSignedUrl,
} from "@/lib/media";

export default function GroupInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentUser } = useAuth();
  const authToken = useAuthToken();
  const {
    chats,
    users,
    getComposeContacts,
    updateGroup,
    addGroupMembers,
    removeGroupMember,
    leaveGroup,
    deleteConversation,
    createGroupInviteLink,
    isGroupAdmin,
  } = useChats();

  const chat = chats.find((item) => item.id === id);
  const currentUserId = currentUser?.id ?? "";
  const isAdmin = chat ? isGroupAdmin(chat, currentUserId) : false;
  const memberIds = chat?.participantIds ?? [];
  const members = memberIds
    .map((memberId) => users[memberId])
    .filter((member): member is NonNullable<typeof member> => Boolean(member));

  const [titleDraft, setTitleDraft] = useState(chat?.name ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isInviteLoading, setIsInviteLoading] = useState(false);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [addMembersSearch, setAddMembersSearch] = useState("");
  const [addMembersContacts, setAddMembersContacts] = useState<ComposeContactOption[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [addMembersLoading, setAddMembersLoading] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<GroupSettings>(DEFAULT_GROUP_SETTINGS);

  const initials = chat
    ? getGroupDisplayInitials(chat, users, currentUserId)
    : "GR";
  const avatarColor = chat ? getGroupDisplayColor(chat.id) : colors.primary;

  const selectableContacts = useMemo(
    () =>
      addMembersContacts.filter(
        (contact) =>
          contact.userId &&
          !memberIds.includes(contact.userId) &&
          contact.isRegistered &&
          `${contact.name} ${contact.phone}`.toLowerCase().includes(addMembersSearch.toLowerCase()),
      ),
    [addMembersContacts, addMembersSearch, memberIds],
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    if (!chat?.groupSettings) return;
    setSettingsDraft(chat.groupSettings);
  }, [chat?.groupSettings, chat?.id]);

  if (!chat || chat.type !== "group") {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
          Groupe introuvable
        </Text>
      </View>
    );
  }

  const groupSettings = chat.groupSettings ?? DEFAULT_GROUP_SETTINGS;
  const canAddMembers = groupSettings.accessMode !== "closed" || isAdmin;
  const canShareInvite = isAdmin || groupSettings.accessMode !== "closed";

  const saveGroupSettings = async (next: Partial<GroupSettings>) => {
    if (!id || !isAdmin) return;
    const merged = { ...settingsDraft, ...next };
    setSettingsDraft(merged);
    setIsSaving(true);
    try {
      await updateGroup(id, { groupSettings: merged });
    } catch (error) {
      setSettingsDraft(chat.groupSettings ?? DEFAULT_GROUP_SETTINGS);
      Alert.alert(
        "Modification impossible",
        error instanceof Error ? error.message : "Impossible de mettre à jour les permissions.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const openAddMembers = async () => {
    setAddMembersOpen(true);
    setAddMembersLoading(true);
    try {
      const contacts = await getComposeContacts();
      setAddMembersContacts(contacts);
    } finally {
      setAddMembersLoading(false);
    }
  };

  const saveGroupTitle = async () => {
    if (!id) return;
    const nextTitle = titleDraft.trim();
    if (!nextTitle || nextTitle === chat.name) return;

    setIsSaving(true);
    try {
      await updateGroup(id, { title: nextTitle });
    } catch (error) {
      Alert.alert(
        "Modification impossible",
        error instanceof Error ? error.message : "Impossible de renommer le groupe.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const pickGroupAvatar = async () => {
    if (!id || !isAdmin) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]?.uri) return;

    setIsSaving(true);
    try {
      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? "image/jpeg";
      let avatarUrl = asset.uri;

      if (authToken) {
        const target = await createMediaUploadTarget(authToken, {
          category: "avatar",
          mimeType,
        });
        await uploadFileToSignedUrl(target.uploadUrl, asset.uri, mimeType);
        avatarUrl = await getUploadDisplayUrl(authToken, target.key, target.publicUrl);
      }

      await updateGroup(id, { avatarUrl });
    } catch (error) {
      Alert.alert(
        "Photo impossible",
        error instanceof Error ? error.message : "Impossible de mettre à jour la photo du groupe.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const shareInviteLink = async () => {
    if (!id) return;
    setIsInviteLoading(true);
    try {
      const invite = await createGroupInviteLink(id);
      await Share.share({
        message: buildGroupInviteShareMessage(chat.name, invite.inviteUrl),
      });
    } catch (error) {
      Alert.alert(
        "Invitation impossible",
        error instanceof Error ? error.message : "Impossible de créer le lien d'invitation.",
      );
    } finally {
      setIsInviteLoading(false);
    }
  };

  const confirmLeaveGroup = () => {
    Alert.alert("Quitter le groupe", "Vous ne recevrez plus les messages de ce groupe.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Quitter",
        style: "destructive",
        onPress: () => {
          void leaveGroup(chat.id)
            .then(() => {
              router.replace("/(tabs)");
            })
            .catch((error) => {
              Alert.alert(
                "Action impossible",
                error instanceof Error ? error.message : "Impossible de quitter le groupe.",
              );
            });
        },
      },
    ]);
  };

  const confirmDeleteGroup = () => {
    if (!chat) return;
    Alert.alert(
      "Supprimer le groupe ?",
      `Le groupe « ${chat.name ?? "Sans nom"} » sera supprimé pour tous les membres. Cette action est irréversible.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            void deleteConversation(chat.id)
              .then(() => {
                router.replace("/(tabs)");
              })
              .catch((error) => {
                Alert.alert(
                  "Suppression impossible",
                  error instanceof Error ? error.message : "Impossible de supprimer ce groupe.",
                );
              });
          },
        },
      ],
    );
  };

  const confirmRemoveMember = (memberId: string, memberName: string) => {
    Alert.alert(
      "Retirer du groupe",
      `${memberName} ne pourra plus voir les messages de ce groupe.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Retirer",
          style: "destructive",
          onPress: () => {
            void removeGroupMember(chat.id, memberId).catch((error) => {
              Alert.alert(
                "Action impossible",
                error instanceof Error ? error.message : "Impossible de retirer ce membre.",
              );
            });
          },
        },
      ],
    );
  };

  const submitAddedMembers = async () => {
    if (!id || selectedMemberIds.length === 0) return;
    setAddMembersLoading(true);
    try {
      await addGroupMembers(id, selectedMemberIds);
      setAddMembersOpen(false);
      setSelectedMemberIds([]);
      setAddMembersSearch("");
      Alert.alert("Invitations envoyées", "Les membres devront accepter pour rejoindre le groupe.");
    } catch (error) {
      Alert.alert(
        "Ajout impossible",
        error instanceof Error ? error.message : "Impossible d'ajouter ces membres.",
      );
    } finally {
      setAddMembersLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Infos du groupe</Text>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={members}
        keyExtractor={(member) => member.id}
        contentContainerStyle={{ paddingBottom: bottomPad + 24 }}
        ListHeaderComponent={
          <View style={styles.hero}>
            <TouchableOpacity
              onPress={() => {
                if (isAdmin) void pickGroupAvatar();
              }}
              activeOpacity={isAdmin ? 0.8 : 1}
              disabled={!isAdmin || isSaving}
            >
              <Avatar
                uri={chat.avatarUrl}
                initials={initials}
                color={avatarColor}
                size={96}
              />
              {isAdmin ? (
                <Text style={[styles.changePhoto, { color: colors.primary }]}>
                  Changer la photo
                </Text>
              ) : null}
            </TouchableOpacity>

            {isAdmin ? (
              <View style={styles.titleEditRow}>
                <TextInput
                  style={[styles.titleInput, { color: colors.text, borderColor: colors.border }]}
                  value={titleDraft}
                  onChangeText={setTitleDraft}
                  placeholder="Nom du groupe"
                  placeholderTextColor={colors.mutedForeground}
                  onBlur={() => {
                    void saveGroupTitle();
                  }}
                />
                {isSaving ? <ActivityIndicator color={colors.primary} /> : null}
              </View>
            ) : (
              <Text style={[styles.groupTitle, { color: colors.text }]}>
                {chat.name ?? "Groupe"}
              </Text>
            )}

            <Text style={[styles.memberCount, { color: colors.mutedForeground }]}>
              {getGroupMemberCountLabel(members.length)}
              {isAdmin ? " · Administrateur" : ""}
            </Text>

            <View style={styles.actionsRow}>
              {canAddMembers ? (
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => {
                    void openAddMembers();
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="person-add-outline" size={22} color={colors.primary} />
                  <Text style={[styles.actionLabel, { color: colors.text }]}>Ajouter</Text>
                </TouchableOpacity>
              ) : null}

              {canShareInvite ? (
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => {
                    void shareInviteLink();
                  }}
                  activeOpacity={0.8}
                  disabled={isInviteLoading}
                >
                  {isInviteLoading ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Feather name="link" size={22} color={colors.primary} />
                  )}
                  <Text style={[styles.actionLabel, { color: colors.text }]}>Inviter</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => {
                  if (!id) return;
                  router.push(`/chat-media/${id}`);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="images-outline" size={22} color={colors.primary} />
                <Text style={[styles.actionLabel, { color: colors.text }]}>Médias</Text>
              </TouchableOpacity>
            </View>

            {isAdmin ? (
              <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.settingsTitle, { color: colors.text }]}>Permissions du groupe</Text>

                <Text style={[styles.settingsLabel, { color: colors.mutedForeground }]}>
                  Accès et invitations
                </Text>
                {(["closed", "invite", "open"] as GroupAccessMode[]).map((mode) => {
                  const selected = settingsDraft.accessMode === mode;
                  return (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.settingsOption, { borderColor: colors.border }]}
                      onPress={() => {
                        void saveGroupSettings({ accessMode: mode });
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={selected ? "radio-button-on" : "radio-button-off"}
                        size={20}
                        color={selected ? colors.primary : colors.mutedForeground}
                      />
                      <Text style={[styles.settingsOptionText, { color: colors.text }]}>
                        {groupAccessModeLabel(mode)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={[styles.settingsToggleRow, { borderTopColor: colors.border }]}
                  onPress={() => {
                    void saveGroupSettings({
                      membersCanSendMedia: !settingsDraft.membersCanSendMedia,
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.settingsOptionText, { color: colors.text }]}>
                    Les membres peuvent envoyer des médias
                  </Text>
                  <Ionicons
                    name={settingsDraft.membersCanSendMedia ? "toggle" : "toggle-outline"}
                    size={28}
                    color={settingsDraft.membersCanSendMedia ? colors.primary : colors.mutedForeground}
                  />
                </TouchableOpacity>
              </View>
            ) : null}

            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              {members.length} membres
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isSelf = item.id === currentUserId;
          const canRemove = isAdmin && !isSelf;

          return (
            <TouchableOpacity
              style={[styles.memberRow, { borderBottomColor: colors.border }]}
              onPress={() => router.push(`/profile/${item.id}`)}
              onLongPress={
                canRemove
                  ? () => {
                      confirmRemoveMember(item.id, item.name);
                    }
                  : undefined
              }
              activeOpacity={0.75}
            >
              <Avatar uri={item.avatar} initials={item.initials} color={item.color} size={48} />
              <View style={styles.memberInfo}>
                <Text style={[styles.memberName, { color: colors.text }]}>
                  {item.name}
                  {isSelf ? " (Vous)" : ""}
                </Text>
                <Text style={[styles.memberStatus, { color: colors.mutedForeground }]}>
                  {chat.createdBy === item.id ? "Administrateur" : item.status}
                </Text>
              </View>
              {canRemove ? (
                <TouchableOpacity
                  onPress={() => {
                    confirmRemoveMember(item.id, item.name);
                  }}
                  hitSlop={8}
                >
                  <Feather name="user-minus" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          <TouchableOpacity
            style={[styles.leaveBtn, { borderColor: colors.destructive ?? "#EF4444" }]}
            onPress={isAdmin ? confirmDeleteGroup : confirmLeaveGroup}
            activeOpacity={0.8}
          >
            <Text style={[styles.leaveBtnText, { color: colors.destructive ?? "#EF4444" }]}>
              {isAdmin ? "Supprimer le groupe" : "Quitter le groupe"}
            </Text>
          </TouchableOpacity>
        }
      />

      <Modal visible={addMembersOpen} animationType="slide" onRequestClose={() => setAddMembersOpen(false)}>
        <View style={[styles.modalRoot, { backgroundColor: colors.background, paddingTop: topPad + 12 }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Ajouter des membres</Text>
            <TouchableOpacity onPress={() => setAddMembersOpen(false)} activeOpacity={0.7}>
              <Text style={[styles.modalAction, { color: colors.primary }]}>Fermer</Text>
            </TouchableOpacity>
          </View>

          <SearchBar
            value={addMembersSearch}
            onChangeText={setAddMembersSearch}
            placeholder="Rechercher un contact..."
          />

          <FlatList
            data={selectableContacts}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              addMembersLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
              ) : (
                <Text style={[styles.emptyContacts, { color: colors.mutedForeground }]}>
                  Aucun contact disponible à ajouter.
                </Text>
              )
            }
            renderItem={({ item }) => {
              const selected = item.userId ? selectedMemberIds.includes(item.userId) : false;
              return (
                <TouchableOpacity
                  style={[styles.memberRow, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    if (!item.userId) return;
                    setSelectedMemberIds((prev) =>
                      prev.includes(item.userId!)
                        ? prev.filter((value) => value !== item.userId)
                        : [...prev, item.userId!],
                    );
                  }}
                  activeOpacity={0.75}
                >
                  <Avatar uri={item.avatar} initials={item.initials} color={item.color} size={46} />
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.memberStatus, { color: colors.mutedForeground }]}>
                      {item.phone}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.checkBadge,
                      {
                        backgroundColor: selected ? colors.primary : "transparent",
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    {selected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                  </View>
                </TouchableOpacity>
              );
            }}
          />

          <TouchableOpacity
            style={[
              styles.submitBtn,
              {
                backgroundColor: selectedMemberIds.length ? colors.primary : colors.muted,
                marginBottom: bottomPad + 12,
              },
            ]}
            disabled={!selectedMemberIds.length || addMembersLoading}
            onPress={() => {
              void submitAddedMembers();
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.submitBtnText}>Ajouter au groupe</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  hero: { alignItems: "center", paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  changePhoto: { textAlign: "center", marginTop: 8, fontFamily: "Inter_500Medium" },
  titleEditRow: {
    width: "100%",
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  titleInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  groupTitle: {
    marginTop: 16,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  memberCount: { marginTop: 6, fontSize: 14, fontFamily: "Inter_400Regular" },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    marginBottom: 8,
  },
  actionCard: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    gap: 8,
  },
  actionLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  settingsCard: {
    width: "100%",
    marginTop: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  settingsTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 4 },
  settingsLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" },
  settingsOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingsOptionText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  settingsToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    alignSelf: "flex-start",
    marginTop: 18,
    marginBottom: 8,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  memberStatus: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 2 },
  leaveBtn: {
    marginHorizontal: 16,
    marginTop: 24,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  leaveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  errorText: { textAlign: "center", marginTop: 40, fontSize: 16 },
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalAction: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyContacts: { textAlign: "center", marginTop: 24, fontSize: 15 },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  submitBtn: {
    marginHorizontal: 16,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
