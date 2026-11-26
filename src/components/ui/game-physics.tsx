import * as React from "react"
import { Physics, RigidBody } from "@react-three/rapier"
import { LevelObject, type LevelItem } from "@/components/ui/game-3d"
import type * as THREE from "three"

// Real physics for a game's level (game-3d.tsx loads this only while a game with physics rows plays): a row with
// physics "dynamic" falls, bounces and is pushed; "fixed" is solid and stays put. At rest the level is drawn as written.

const kDegrees = Math.PI / 180

export default function GamePhysics({ level, objects, gravity = -9.81, children }: { level: LevelItem[]; objects: React.RefObject<(THREE.Object3D | null)[]>; gravity?: number; children?: React.ReactNode }) {
  return (
    <Physics gravity={[0, gravity, 0]}>
      {level.map((item, index) =>
        item.physics ? (
          <RigidBody
            key={index}
            type={item.physics === "fixed" ? "fixed" : "dynamic"}
            colliders={item.shape === "sphere" ? "ball" : item.shape === "cylinder" || item.shape === "coin" ? "hull" : "cuboid"}
            position={[item.x ?? 0, item.y ?? 0, item.z ?? 0]}
            rotation={[(item.rx ?? 0) * kDegrees, (item.ry ?? 0) * kDegrees, (item.rz ?? 0) * kDegrees]}
            restitution={0.3}
          >
            <LevelObject item={item} index={index} objects={objects} placed={false} />
          </RigidBody>
        ) : (
          <LevelObject key={index} item={item} index={index} objects={objects} />
        )
      )}
      {children}
    </Physics>
  )
}
