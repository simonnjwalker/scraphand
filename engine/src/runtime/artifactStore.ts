import type { Artifact, ArtifactStore } from "sh1-runtime";

export class InMemoryArtifactStore implements ArtifactStore {
  private items: Artifact[] = [];

  add(a: Artifact): void {
    this.items.push(a);
  }

  all(type?: string): Artifact[] {
    return type ? this.items.filter(x => x.type === type) : [...this.items];
  }
}
