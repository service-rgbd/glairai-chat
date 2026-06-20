import * as Contacts from "expo-contacts";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export type SaveNativeContactResult =
  | { status: "created"; contactId: string }
  | { status: "already_exists"; contactName: string }
  | { status: "permission_denied" };

function normalizePhoneForCompare(phone: string, defaultCountryCode = "GN") {
  const trimmed = phone.trim();
  const parsed =
    parsePhoneNumberFromString(trimmed, defaultCountryCode as never) ??
    parsePhoneNumberFromString(trimmed);
  if (parsed) return parsed.number;
  const digits = trimmed.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : trimmed;
}

function contactDisplayName(contact: Contacts.Contact) {
  const fullName = contact.name?.trim();
  if (fullName) return fullName;
  const composed = [contact.firstName, contact.middleName, contact.lastName]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean)
    .join(" ")
    .trim();
  return composed || "Contact";
}

async function findNativeContactByPhone(phone: string, defaultCountryCode = "GN") {
  const target = normalizePhoneForCompare(phone, defaultCountryCode);
  if (!target) return null;

  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
    pageSize: 1000,
  });

  for (const contact of data) {
    for (const entry of contact.phoneNumbers ?? []) {
      if (!entry?.number) continue;
      try {
        if (normalizePhoneForCompare(entry.number, defaultCountryCode) === target) {
          return contact;
        }
      } catch {
        // Ignore malformed numbers in the address book.
      }
    }
  }

  return null;
}

export async function saveUserToNativeContacts(input: {
  name: string;
  phone: string;
  defaultCountryCode?: string;
}): Promise<SaveNativeContactResult> {
  if (!input.phone?.trim()) {
    throw new Error("Numéro indisponible");
  }

  const permission = await Contacts.requestPermissionsAsync();
  if (permission.status !== "granted") {
    return { status: "permission_denied" };
  }

  const existing = await findNativeContactByPhone(
    input.phone,
    input.defaultCountryCode ?? "GN",
  );
  if (existing) {
    return { status: "already_exists", contactName: contactDisplayName(existing) };
  }

  const parts = input.name.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? input.name.trim();
  const lastName = parts.slice(1).join(" ");

  const contactId = await Contacts.addContactAsync({
    contactType: Contacts.ContactTypes.Person,
    name: input.name.trim(),
    firstName,
    lastName: lastName || undefined,
    phoneNumbers: [{ label: "mobile", number: input.phone.trim() }],
  });

  return { status: "created", contactId };
}
