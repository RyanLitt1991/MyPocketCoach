import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";

/* -------------------- STORAGE -------------------- */

const STORAGE_KEY = "mypocketcoach_data";

const storage = {
  async get() {
    try {
      const v =
        Platform.OS === "web"
          ? localStorage.getItem(STORAGE_KEY)
          : null;
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  },
  async set(value) {
    try {
      if (Platform.OS === "web") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      }
    } catch {}
  },
};

/* -------------------- NORMALIZATION -------------------- */

const normalize = (t) =>
  (t || "").toLowerCase().trim().replace(/\s+/g, " ");

const matchGoal = (goal) => {
  const g = normalize(goal);
  if (g.includes("fat") || g.includes("cut") || g.includes("lean"))
    return "fatloss";
  return "muscle";
};

const matchExperience = (exp) => {
  const e = normalize(exp);
  if (e.includes("inter")) return "intermediate";
  if (e.includes("adv")) return "intermediate";
  return "beginner";
};

/* -------------------- REP RANGES (RESTORED PROPERLY) -------------------- */

const getRepRange = (name) => {
  name = name.toLowerCase();

  if (name.includes("squat") || name.includes("deadlift"))
    return [5, 8];

  if (name.includes("press"))
    return [6, 10];

  if (name.includes("row") || name.includes("pulldown"))
    return [8, 12];

  if (name.includes("raise") || name.includes("fly"))
    return [10, 15];

  return [10, 15];
};

/* -------------------- PROGRAM -------------------- */

const addRanges = (days) =>
  days.map((d) => ({
    ...d,
    exercises: d.exercises.map((ex) => ({
      ...ex,
      repRange: getRepRange(ex.name),
    })),
  }));

const generateProgram = (goal, exp) => {
  const g = matchGoal(goal);
  const e = matchExperience(exp);

  if (g === "muscle" && e === "intermediate") {
    return {
      name: "5-Day Hypertrophy Split",
      days: addRanges([
        {
          name: "Push",
          exercises: [
            { name: "Incline DB Press", weight: 40 },
            { name: "Flat Machine Press", weight: 100 },
            { name: "Shoulder Press", weight: 50 },
            { name: "Lateral Raises", weight: 12 },
            { name: "Tricep Pushdown", weight: 35 },
          ],
        },
        {
          name: "Pull",
          exercises: [
            { name: "Lat Pulldown", weight: 60 },
            { name: "Seated Row", weight: 60 },
            { name: "Face Pull", weight: 25 },
            { name: "Barbell Curl", weight: 30 },
          ],
        },
        {
          name: "Quads",
          exercises: [
            { name: "Back Squat", weight: 100 },
            { name: "Leg Press", weight: 160 },
            { name: "Leg Extension", weight: 60 },
          ],
        },
        {
          name: "Posterior Chain",
          exercises: [
            { name: "RDL", weight: 100 },
            { name: "Hamstring Curl", weight: 55 },
            { name: "Hip Thrust", weight: 120 },
          ],
        },
        {
          name: "Upper Aesthetic",
          exercises: [
            { name: "Cable Fly", weight: 25 },
            { name: "Lat Pulldown", weight: 60 },
            { name: "Lateral Raises", weight: 10 },
          ],
        },
      ]),
    };
  }

  return {
    name: "3-Day Fat Loss Plan",
    days: addRanges([]),
  };
};

/* -------------------- APP -------------------- */

export default function App() {
  const [screen, setScreen] = useState("intro");
  const [goal, setGoal] = useState("");
  const [exp, setExp] = useState("");

  const [program, setProgram] = useState(null);
  const [log, setLog] = useState({});
  const [weights, setWeights] = useState({});
  const [history, setHistory] = useState([]);
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [progression, setProgression] = useState({});
  const [ready, setReady] = useState(false);

  /* -------------------- LOAD -------------------- */

  useEffect(() => {
    (async () => {
      const saved = await storage.get();
      if (saved) {
        setProgram(saved.program || null);
        setHistory(saved.history || []);
        setProgression(saved.progression || {});
      }
      setReady(true);
    })();
  }, []);

  const persist = async (data) => {
    await storage.set(data);
  };

  const start = async () => {
    const p = generateProgram(goal, exp);
    setProgram(p);
    setScreen("home");

    persist({ program: p, history, progression });
  };

  /* -------------------- LOG WORKOUT -------------------- */

  const logWorkout = (day) => {
    let newProgression = { ...progression };

    const updatedDays = program.days.map((d) => {
      if (d.name !== day.name) return d;

      return {
        ...d,
        exercises: d.exercises.map((ex) => {
          const reps = log[ex.name] || ["", "", "", ""];
          const inputWeight = parseFloat(weights[ex.name] || ex.weight);
          const [min, max] = ex.repRange;

          if (!newProgression[ex.name]) newProgression[ex.name] = [];

          const hitTopRange = reps.every(
            (r) => parseInt(r || "0") >= max
          );

          const newWeight = hitTopRange
            ? inputWeight + 2.5
            : inputWeight;

          newProgression[ex.name].push({
            date: new Date().toLocaleDateString(),
            weight: inputWeight,
            reps,
          });

          return {
            ...ex,
            weight: newWeight,
            usedWeight: inputWeight,
          };
        }),
      };
    });

    const entry = {
      date: new Date().toLocaleDateString(),
      day: day.name,
      exercises: updatedDays
        .find((d) => d.name === day.name)
        .exercises.map((ex) => ({
          name: ex.name,
          weight: ex.usedWeight,
          reps: log[ex.name] || [],
          repRange: ex.repRange, // ✅ RESTORED
        })),
    };

    const newHistory = [entry, ...history];
    const newProgram = { ...program, days: updatedDays };

    setProgram(newProgram);
    setHistory(newHistory);
    setProgression(newProgression);
    setLog({});
    setWeights({});
    setScreen("home");

    persist({
      program: newProgram,
      history: newHistory,
      progression: newProgression,
    });
  };

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Text style={{ textAlign: "center" }}>Loading...</Text>
      </View>
    );
  }

  /* -------------------- INTRO -------------------- */

  if (screen === "intro") {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
        <Text style={{ fontSize: 30, textAlign: "center" }}>
          MyPocketCoach
        </Text>

        <Button
          title="Start Consultation"
          onPress={() => setScreen("consult")}
        />
      </View>
    );
  }

  /* -------------------- CONSULT -------------------- */

  if (screen === "consult") {
    return (
      <View style={{ padding: 20, marginTop: 50 }}>
        <Text>Goal</Text>
        <TextInput
          value={goal}
          onChangeText={setGoal}
          style={{ borderWidth: 1 }}
        />

        <Text>Experience</Text>
        <TextInput
          value={exp}
          onChangeText={setExp}
          style={{ borderWidth: 1 }}
        />

        <Button title="Generate Program" onPress={start} />
      </View>
    );
  }

  /* -------------------- WORKOUT -------------------- */

  if (screen === "workout") {
    const day = selectedWorkout;

    return (
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140 }}>
        <Text style={{ fontSize: 22 }}>{day.name}</Text>

        {day.exercises.map((ex) => {
          const reps = log[ex.name] || ["", "", "", ""];
          const [min, max] = ex.repRange;

          return (
            <View key={ex.name} style={{ marginVertical: 10 }}>
              <Text>{ex.name}</Text>
              <Text>
                Target: {min}-{max} reps
              </Text>

              <View style={{ flexDirection: "row" }}>
                <TextInput
                  value={weights[ex.name]?.toString() || ex.weight.toString()}
                  onChangeText={(v) =>
                    setWeights({ ...weights, [ex.name]: v })
                  }
                  style={{ borderWidth: 1, width: 60 }}
                />
                <Text> kg</Text>
              </View>

              {[0, 1, 2, 3].map((i) => (
                <TextInput
                  key={i}
                  placeholder={`Set ${i + 1}`}
                  value={reps[i]}
                  onChangeText={(v) => {
                    const r = log[ex.name] || [];
                    r[i] = v;
                    setLog({ ...log, [ex.name]: r });
                  }}
                  style={{ borderWidth: 1, marginVertical: 2 }}
                />
              ))}
            </View>
          );
        })}

        <Button title="Log Workout" onPress={() => logWorkout(day)} />
        <Button title="Back" onPress={() => setScreen("home")} />
      </ScrollView>
    );
  }

  /* -------------------- HISTORY -------------------- */

  if (screen === "historyDetail") {
    const h = selectedWorkout;

    return (
      <ScrollView style={{ padding: 20 }}>
        <Text style={{ fontSize: 22 }}>{h.day}</Text>
        <Text>{h.date}</Text>

        {h.exercises.map((ex, i) => (
          <View key={i}>
            <Text>{ex.name}</Text>
            <Text>
              {ex.weight} kg | {ex.repRange?.join("-")} reps
            </Text>
            <Text>{ex.reps.join(", ")}</Text>
          </View>
        ))}

        <Button title="Back" onPress={() => setScreen("home")} />
      </ScrollView>
    );
  }

  /* -------------------- HOME -------------------- */

  return (
    <ScrollView style={{ padding: 20 }}>
      <Text style={{ fontSize: 26 }}>MyPocketCoach</Text>

      {program?.days.map((day) => (
        <TouchableOpacity
          key={day.name}
          onPress={() => {
            setSelectedWorkout(day);
            setScreen("workout");
          }}
          style={{ borderWidth: 1, padding: 10, marginTop: 10 }}
        >
          <Text>{day.name}</Text>
        </TouchableOpacity>
      ))}

      <Text style={{ marginTop: 20 }}>History</Text>

      {history.map((h, i) => (
        <TouchableOpacity
          key={i}
          onPress={() => {
            setSelectedWorkout(h);
            setScreen("historyDetail");
          }}
          style={{ borderWidth: 1, padding: 10, marginTop: 10 }}
        >
          <Text>{h.date}</Text>
          <Text>{h.day}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}