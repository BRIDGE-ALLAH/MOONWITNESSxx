import { Badge, Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@riotworks/ui'

const productFamilies = [
  {
    id: 1,
    title: 'Digital Art',
    creativeBrief: 'A collection of digital artwork pieces for marketplace sale.',
    formats: ['Static image (PNG, GIF)', 'Animated GIF', 'Video (MP4, WebM)'],
    generatedPreview: 'https://picsum.photos/seed/digital-art/800/800',
    version: '1.0.0',
    sourceAssets: ['artwork.ai', 'color-palette.json', 'metadata.json'],
    modelToolProvenance: 'Stable Diffusion v2.1 + Photoshop AI',
    specialist: 'Maker',
    productionState: 'draft',
    qualityState: 'review',
    distributionPackage: 'Digital download package; marketplace listing ready.',
  },
  {
    id: 2,
    title: 'Comic Series',
    creativeBrief: 'A comic book series with original characters and storylines.',
    formats: ['Print PDF', 'Digital PDF', 'Web comic'],
    generatedPreview: 'https://picsum.photos/seed/comic-series/800/800',
    version: '1.0.0',
    sourceAssets: ['character-designs.ai', 'storyboard.ai', 'ink-sketches.ai'],
    modelToolProvenance: 'Midjourney v6 + Clip Studio Paint',
    specialist: 'Maker',
    productionState: 'review',
    qualityState: 'review',
    distributionPackage: 'Print on demand; digital download; comic platform listing.',
  },
  {
    id: 3,
    title: 'Music Beat',
    creativeBrief: 'A collection of music beats for licensing and sale.',
    formats: ['MP3', 'WAV', 'Stem WEM'],
    generatedPreview: 'https://picsum.photos/seed/music-beat/800/800',
    version: '1.0.0',
    sourceAssets: ['audio-stems.wav', 'project-file.ableton', 'metadata.json'],
    modelToolProvenance: 'Ableton Live 12 + iZotope RX',
    specialist: 'Maker',
    productionState: 'review',
    qualityState: 'review',
    distributionPackage: 'Digital download; marketplace listing; sync licensing ready.',
  },
]

export default function TheForge() {
  return (
    <main className="min-h-screen bg-obsidian text-paper-bone p-8">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-acid-lime/30 pb-8 mb-8">
          <h1 className="text-5xl font-display uppercase leading-none mb-4">
            THE FORGE
          </h1>
          <p className="font-mono text-sm uppercase tracking-widest text-muted-ink">
            Product Workshop
          </p>
        </header>

        <section className="grid grid-cols-2 gap-6 mb-8">
          {productFamilies.map((product) => (
            <Card key={product.id} className="border-acid-lime/30">
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wider">{product.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <details>
                  <summary className="cursor-pointer text-sm text-acid-lime underline">
                    Creative Brief
                  </summary>
                  <p>{product.creativeBrief}</p>
                </details>

                <details>
                  <summary className="cursor-pointer text-sm text-acid-lime underline">
                    Formats
                  </summary>
                  <p>
                    {product.formats.map((fmt, idx) => (
                      <span key={idx} className="text-sm font-mono mr-2">
                        {fmt}
                      </span>
                    ))}
                  </p>
                </details>

                <details>
                  <summary className="cursor-pointer text-sm text-acid-lime underline">
                    Version
                  </summary>
                  <p>{product.version}</p>
                </details>

                <details>
                  <summary className="cursor-pointer text-sm text-acid-lime underline">
                    Source Assets
                  </summary>
                  <p>{product.sourceAssets.join(', ')}</p>
                </details>

                <details>
                  <summary className="cursor-pointer text-sm text-acid-lime underline">
                    Model/Tool Provenance
                  </summary>
                  <p>{product.modelToolProvenance}</p>
                </details>

                <details>
                  <summary className="cursor-pointer text-sm text-acid-lime underline">
                    Assigned Specialist
                  </summary>
                  <p>{product.specialist}</p>
                </details>

                <details>
                  <summary className="cursor-pointer text-sm text-acid-lime underline">
                    Production State
                  </summary>
                  <Badge variant="outline" className="ml-2 text-xs">{product.productionState}</Badge>
                  <p>{product.productionState}</p>
                </details>

                <details>
                  <summary className="cursor-pointer text-sm text-acid-lime underline">
                    Quality State
                  </summary>
                  <Badge variant="outline" className="ml-2 text-xs">{product.qualityState}</Badge>
                  <p>{product.qualityState}</p>
                </details>

                <details>
                  <summary className="cursor-pointer text-sm text-acid-lime underline">
                    Distribution Package
                  </summary>
                  <p>{product.distributionPackage}</p>
                </details>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  )
}