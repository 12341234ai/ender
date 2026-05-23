import { useState } from "react";
import ProfileScreen, { Profile } from "./ProfileScreen";
import Game3D from "./Game3D";
import "./index.css";

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);

  if (!profile) {
    return <ProfileScreen onSelect={setProfile} />;
  }

  return <Game3D key={profile.name} profile={profile} onExit={() => setProfile(null)} />;
}
