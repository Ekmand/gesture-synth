/** Client-side arrangement patches when community rows need a content fix. */
import type { ArrangementRow, Mode } from "./arrangementTypes"

type Override = Partial<
  Pick<ArrangementRow, "key_name" | "description" | "arrangement" | "mode" | "bpm">
>

type ListItemPatch = {
  id: string
  key_name: string
  description: string
  mode: Mode
  bpm: number
}

const OVERRIDES: Record<string, Override> = {
  "595ac88e-1005-41b4-8409-341fb125b4f4": {
    "key_name": "Ab",
    "description": "The Beatles - Key Ab - From Rafferty Coope performance (youtube.com/shorts/desGIrzWLIk)",
    "mode": "major",
    "bpm": 72,
    "arrangement": {
      "version": 2,
      "keyName": "Ab",
      "mode": "major",
      "bpm": 72,
      "stepsPerBar": 4,
      "barCount": 16,
      "notes": [
        {
          "id": "b43cef8f-cb6b-41a2-afdf-188533cddc10",
          "midi": 68,
          "start": 0,
          "duration": 4
        },
        {
          "id": "536a0604-8bea-4a35-8d3a-a8f0c6ad40e5",
          "midi": 75,
          "start": 0,
          "duration": 4
        },
        {
          "id": "49722f35-0e78-45d3-8495-0ed6caaa3b4e",
          "midi": 80,
          "start": 0,
          "duration": 4
        },
        {
          "id": "e0ff72f7-7e42-4699-86d1-cbac5281d931",
          "midi": 84,
          "start": 0,
          "duration": 4
        },
        {
          "id": "17798463-57bc-49d9-9df2-3be5ba8a23fb",
          "midi": 75,
          "start": 4,
          "duration": 4
        },
        {
          "id": "e8f27124-61a2-4867-9c1c-fd51ca61a5f6",
          "midi": 82,
          "start": 4,
          "duration": 4
        },
        {
          "id": "7a0d9086-85fa-4630-92b6-a45b47037977",
          "midi": 87,
          "start": 4,
          "duration": 4
        },
        {
          "id": "8804e227-f5f2-4898-ae8e-b75bd59d7786",
          "midi": 91,
          "start": 4,
          "duration": 4
        },
        {
          "id": "96629d13-0289-4a00-9c2b-cec273832d24",
          "midi": 77,
          "start": 8,
          "duration": 4
        },
        {
          "id": "67970813-be81-497a-a3cd-e27df890396a",
          "midi": 84,
          "start": 8,
          "duration": 4
        },
        {
          "id": "30a85a3a-897b-4784-9fce-4edae5a044c2",
          "midi": 89,
          "start": 8,
          "duration": 4
        },
        {
          "id": "07bedbb1-1740-4a7a-a3fa-32d915efbe34",
          "midi": 92,
          "start": 8,
          "duration": 4
        },
        {
          "id": "152909c0-1107-4109-8931-ba6a49d1d00c",
          "midi": 73,
          "start": 12,
          "duration": 4
        },
        {
          "id": "f80470f1-9e72-418b-90a1-be1fd3e25104",
          "midi": 80,
          "start": 12,
          "duration": 4
        },
        {
          "id": "2c7cc946-c2db-43ab-8de1-d87689efe4d6",
          "midi": 85,
          "start": 12,
          "duration": 4
        },
        {
          "id": "649b0606-b914-4e3d-900b-67aaa246cee3",
          "midi": 89,
          "start": 12,
          "duration": 4
        },
        {
          "id": "775d5611-e280-4e54-b45d-2dc56b232045",
          "midi": 68,
          "start": 16,
          "duration": 4
        },
        {
          "id": "35777881-cc56-4045-affa-157a5170f16c",
          "midi": 75,
          "start": 16,
          "duration": 4
        },
        {
          "id": "52a000bf-3f76-4a21-904c-e33114d8a9b2",
          "midi": 80,
          "start": 16,
          "duration": 4
        },
        {
          "id": "8ad2bc78-49a3-46d7-a1e2-8473a4831d12",
          "midi": 84,
          "start": 16,
          "duration": 4
        },
        {
          "id": "4b145a50-804f-4071-9325-682ca0983410",
          "midi": 75,
          "start": 20,
          "duration": 4
        },
        {
          "id": "a8cba364-ce5a-42d2-a468-b5bc29d4efc8",
          "midi": 82,
          "start": 20,
          "duration": 4
        },
        {
          "id": "40ef1a8e-f9f4-432b-a68b-f84df04578ca",
          "midi": 87,
          "start": 20,
          "duration": 4
        },
        {
          "id": "2a35577e-2d24-422e-b5d4-3a8daee1c9a2",
          "midi": 91,
          "start": 20,
          "duration": 4
        },
        {
          "id": "23ca228c-45b4-4f19-8a7d-a07a89dcfe00",
          "midi": 73,
          "start": 24,
          "duration": 4
        },
        {
          "id": "9ee768f3-bf48-436b-9aa7-85fc3cde4450",
          "midi": 80,
          "start": 24,
          "duration": 4
        },
        {
          "id": "2334168f-496b-4f21-9ed1-b496125c8990",
          "midi": 85,
          "start": 24,
          "duration": 4
        },
        {
          "id": "198be5c3-bbc7-44c9-b5a5-454ce695bfff",
          "midi": 89,
          "start": 24,
          "duration": 4
        },
        {
          "id": "45260c26-d543-4722-a4a9-f02f4d9f9944",
          "midi": 68,
          "start": 28,
          "duration": 4
        },
        {
          "id": "e8101faf-bd0e-471e-9c67-2e0b4766bde5",
          "midi": 75,
          "start": 28,
          "duration": 4
        },
        {
          "id": "21ce11be-0e68-4afc-bbc9-650bbbfa7af5",
          "midi": 80,
          "start": 28,
          "duration": 4
        },
        {
          "id": "dde45221-6b05-4ef7-9221-f12a3f3262f7",
          "midi": 84,
          "start": 28,
          "duration": 4
        },
        {
          "id": "be2bac03-10ba-485c-8dc9-fb4ad8bdc4aa",
          "midi": 77,
          "start": 32,
          "duration": 4
        },
        {
          "id": "9bfb7a37-e239-49d6-ba58-dce0f8450268",
          "midi": 84,
          "start": 32,
          "duration": 4
        },
        {
          "id": "ef123b7d-1c59-4434-9cdc-e46291022906",
          "midi": 89,
          "start": 32,
          "duration": 4
        },
        {
          "id": "a5340d2c-251d-48e3-9860-244cec3ced74",
          "midi": 92,
          "start": 32,
          "duration": 4
        },
        {
          "id": "13d221f2-8816-48b3-b941-3580fa6b545d",
          "midi": 75,
          "start": 36,
          "duration": 4
        },
        {
          "id": "aed681fb-f7ab-47dd-b45f-67dd292ce693",
          "midi": 82,
          "start": 36,
          "duration": 4
        },
        {
          "id": "ed125e85-690d-4e32-8b10-addabfb04ecb",
          "midi": 87,
          "start": 36,
          "duration": 4
        },
        {
          "id": "b94dc9a8-2a39-4015-b609-9bd41213efaf",
          "midi": 91,
          "start": 36,
          "duration": 4
        },
        {
          "id": "62b8d049-3d3b-439b-a640-5db71c447424",
          "midi": 73,
          "start": 40,
          "duration": 4
        },
        {
          "id": "b806f0bd-c3e4-462f-9809-18512ba16feb",
          "midi": 80,
          "start": 40,
          "duration": 4
        },
        {
          "id": "2bf08440-a302-4560-83ef-3460488e6d15",
          "midi": 85,
          "start": 40,
          "duration": 4
        },
        {
          "id": "6b30f111-f7c6-4bc8-9787-275a7073531e",
          "midi": 89,
          "start": 40,
          "duration": 4
        },
        {
          "id": "f3e7deca-88dc-490e-aec6-5759ee049da3",
          "midi": 68,
          "start": 44,
          "duration": 8
        },
        {
          "id": "291b281a-7693-4e1a-885b-922fb2d29b5a",
          "midi": 75,
          "start": 44,
          "duration": 8
        },
        {
          "id": "a94cbb46-1565-4720-89b5-2d459d0b5804",
          "midi": 80,
          "start": 44,
          "duration": 8
        },
        {
          "id": "6847d224-f834-44a3-9a8a-a27baa31102a",
          "midi": 84,
          "start": 44,
          "duration": 8
        },
        {
          "id": "b0f2519d-9249-46d7-8a1c-e8e0a8042f22",
          "midi": 75,
          "start": 52,
          "duration": 4
        },
        {
          "id": "25fb89d0-3fd6-426f-88c3-f4c845a32290",
          "midi": 82,
          "start": 52,
          "duration": 4
        },
        {
          "id": "c95ac0bf-db5c-44cb-8eba-87a3f795befd",
          "midi": 87,
          "start": 52,
          "duration": 4
        },
        {
          "id": "e5565a67-7ed5-49e6-875c-ee085c6bd286",
          "midi": 91,
          "start": 52,
          "duration": 4
        },
        {
          "id": "cccb0f1a-3f97-41b1-9523-2cedc80f558d",
          "midi": 73,
          "start": 56,
          "duration": 4
        },
        {
          "id": "e06197e6-4d09-4037-88df-b4ae03293efe",
          "midi": 80,
          "start": 56,
          "duration": 4
        },
        {
          "id": "6f4653b7-0c66-4f69-b8f1-d025f2f60275",
          "midi": 85,
          "start": 56,
          "duration": 4
        },
        {
          "id": "36b20c82-2f4e-4c98-8888-ecbe0ba49fb4",
          "midi": 89,
          "start": 56,
          "duration": 4
        },
        {
          "id": "df879f76-732f-4440-8175-2651119c8a5a",
          "midi": 68,
          "start": 60,
          "duration": 4
        },
        {
          "id": "c677f9f9-4967-4ec4-8f60-78111dc6e530",
          "midi": 75,
          "start": 60,
          "duration": 4
        },
        {
          "id": "b32f0f3f-ad59-4584-89ac-fafad3cbed21",
          "midi": 80,
          "start": 60,
          "duration": 4
        },
        {
          "id": "e39f658d-3494-4f47-bd2f-b219f8513ddd",
          "midi": 84,
          "start": 60,
          "duration": 4
        }
      ]
    }
  }
}

export function applyArrangementOverride<T extends { id: string }>(row: T): T {
  const patch = OVERRIDES[row.id]
  if (!patch) return row
  return { ...row, ...patch }
}

export function applyArrangementListOverrides<T extends ListItemPatch>(items: T[]): T[] {
  return items.map((item) => {
    const patch = OVERRIDES[item.id]
    if (!patch) return item
    return {
      ...item,
      key_name: patch.key_name ?? item.key_name,
      description: patch.description ?? item.description,
      mode: patch.mode ?? item.mode,
      bpm: patch.bpm ?? item.bpm,
    }
  })
}
