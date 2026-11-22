import { useHealthQuery } from "./hooks";
import { useSession } from "@/features/auth/session";
import { mockMode } from "@/shared/api";
import type { UserProfileData } from "@/data/db";
import type { Profile, Allergy, Preferences, Page, Course } from "./types";

/** Read-only context projection. Never substitute fixtures for unavailable real data. */
export function usePersonalContext(legacy: UserProfileData) {
  const session = useSession();
  const preferences = useHealthQuery<Preferences>(mockMode ? null : "/preferences");
  const allowed = !mockMode && preferences.data?.ai_context_available === true;
  const profile = useHealthQuery<Profile>(allowed ? "/profile" : null);
  const allergies = useHealthQuery<Page<Allergy>>(allowed ? "/allergies?page_size=100" : null);
  const courses = useHealthQuery<Page<Course>>(
    allowed ? "/medication-courses?status=ACTIVE&page_size=100" : null,
  );
  const available =
    allowed &&
    !!profile.data &&
    !!allergies.data &&
    !!courses.data &&
    allergies.data.pagination.total <= 100 &&
    courses.data.pagination.total <= 100;
  return {
    available: mockMode || available,
    profile: mockMode
      ? legacy
      : available
        ? {
            fullName: profile.data!.full_name || "",
            dob: profile.data!.date_of_birth || "",
            gender: profile.data!.biological_sex || "",
            phone: "",
            conditions: [],
            allergies: allergies.data!.items.map((a) => a.allergen_name),
          }
        : { fullName: "", dob: "", gender: "", phone: "", conditions: [], allergies: [] },
    courses: available ? courses.data!.items : [],
    userId: session.user?.id,
  };
}
