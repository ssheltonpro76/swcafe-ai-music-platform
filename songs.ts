
export interface SavedSong {
  id: string;
  title: string;
  genre: string;
  lyrics: string;
  theme?: string;
  engine: string;
  createdAt: string;
  coverId: number;
  videoArt?: string;
  likesCount?: number;
  remixCount?: number;
  playCount?: number;
  bpm?: number;
}

export const autoSaveSongToLibrary = (songData: Partial<SavedSong> & { title: string; genre?: string; lyrics?: string }): SavedSong => {
  const finalId = songData.id || `sw-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const finalSong: SavedSong = {
    id: finalId,
    title: songData.title.trim() || 'Untitled Generation',
    genre: songData.genre?.trim() || 'Alternative / Ambient',
    lyrics: songData.lyrics || '[Instrumental Track - Synthesized by SwCafe]',
    theme: songData.theme || 'Auto-saved generation',
    engine: songData.engine || 'SwCafe v5.5',
    createdAt: songData.createdAt || new Date().toISOString(),
    coverId: songData.coverId ?? Math.floor(Math.random() * 1000),
    videoArt: songData.videoArt,
    likesCount: songData.likesCount ?? 0,
    remixCount: songData.remixCount ?? (Math.floor(Math.random() * 8) + 1),
    playCount: songData.playCount ?? 1,
    bpm: songData.bpm
  };

  try {
    const raw = localStorage.getItem('swcafe_song_library');
    let library: SavedSong[] = [];
    if (raw) {
      try {
        library = JSON.parse(raw);
      } catch (e) {
        console.error('Failed parsing library', e);
      }
    }
    // Update if exists, otherwise prepend
    const existingIndex = library.findIndex(s => s.id === finalId);
    let updated: SavedSong[];
    if (existingIndex >= 0) {
      updated = [...library];
      updated[existingIndex] = { ...library[existingIndex], ...finalSong };
    } else {
      updated = [finalSong, ...library];
    }
    localStorage.setItem('swcafe_song_library', JSON.stringify(updated));

    // Dispatch global events for instant cross-component updates
    window.dispatchEvent(new CustomEvent('swcafe_song_saved', { detail: finalSong }));
    window.dispatchEvent(new CustomEvent('swcafe_library_updated', { detail: updated }));
  } catch (err) {
    console.error('Auto-save error', err);
  }

  return finalSong;
};

export const autoSaveMultipleSongsToLibrary = (songsData: Array<Partial<SavedSong> & { title: string; genre?: string; lyrics?: string }>): SavedSong[] => {
  try {
    const raw = localStorage.getItem('swcafe_song_library');
    let library: SavedSong[] = [];
    if (raw) {
      try {
        library = JSON.parse(raw);
      } catch (e) {
        console.error('Failed parsing library', e);
      }
    }

    const savedList: SavedSong[] = [];

    songsData.forEach(songData => {
      const finalId = songData.id || `sw-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const finalSong: SavedSong = {
        id: finalId,
        title: songData.title.trim() || 'Untitled Generation',
        genre: songData.genre?.trim() || 'Alternative / Ambient',
        lyrics: songData.lyrics || '[Instrumental Track - Synthesized by SwCafe]',
        theme: songData.theme || 'Auto-saved generation',
        engine: songData.engine || 'SwCafe v5.5',
        createdAt: songData.createdAt || new Date().toISOString(),
        coverId: songData.coverId ?? Math.floor(Math.random() * 1000),
        videoArt: songData.videoArt,
        likesCount: songData.likesCount ?? 0,
        remixCount: songData.remixCount ?? (Math.floor(Math.random() * 8) + 1),
        playCount: songData.playCount ?? 1,
        bpm: songData.bpm
      };
      savedList.push(finalSong);

      const existingIndex = library.findIndex(s => s.id === finalId);
      if (existingIndex >= 0) {
        library[existingIndex] = { ...library[existingIndex], ...finalSong };
      } else {
        library.unshift(finalSong);
      }
    });

    localStorage.setItem('swcafe_song_library', JSON.stringify(library));
    window.dispatchEvent(new CustomEvent('swcafe_library_updated', { detail: library }));
    return savedList;
  } catch (err) {
    console.error('Batch auto-save error', err);
    return [];
  }
};

export const getSavedSongsWithRecalled = (): SavedSong[] => {
  try {
    const saved = localStorage.getItem('swcafe_song_library');
    let currentSongs: SavedSong[] = [];
    if (saved) {
      currentSongs = JSON.parse(saved);
    }
    const missingRecalled = RECALLED_SONGS.filter(rs => !currentSongs.some(s => s.id === rs.id));
    if (missingRecalled.length > 0) {
      const updated = [...missingRecalled, ...currentSongs];
      localStorage.setItem('swcafe_song_library', JSON.stringify(updated));
      return updated;
    }
    return currentSongs;
  } catch (err) {
    return RECALLED_SONGS;
  }
};

export const RECALLED_SONGS: SavedSong[] = [
  {
    id: "3kings-throne-hearts",
    title: "Throne of Hearts (3Kings)",
    genre: "Cinematic R&B",
    engine: "Chujai v4.2",
    theme: "3kings looking for their queens",
    createdAt: "2026-04-16T16:42:00Z",
    coverId: 101,
    lyrics: `[Intro]
(Atmospheric pads swell, distant trumpet fanfare filtered with heavy reverb)
Three golden circles in a neon dark...
Searching for the missing piece of the spark...
Yeah, Chujai v4 in the booth.

[Verse 1]
I got a kingdom built on echoes and binary code
A restless monarch walking down a diamond road
But gravity is heavy when you’re standing alone
The silk is getting cold upon the velvet of the throne
We were three shadows, cast in the same eclipse
With the taste of a billion dreams upon our lips.

[Pre-Chorus]
The scepter’s heavy, the wine is dry
We’re scanning the stars in a digital sky
Looking for the power that we can’t define.

[Chorus]
We are the 3Kings looking for our Queens
Navigating mirrors and the neon scenes
A crown is just metal till it finds its light
We’re hunting the grace in the heart of the night
Where’s the royalty? Where’s the soul?
We’re half a story, waiting to be whole.

[Verse 2]
Gold in the pockets but the vault is still bare
A monarch in exile, breathing empty air
One king for the wisdom, one king for the blade
One king for the silence where the secrets are laid
But the architecture crumbles without the divine
We need the silver thread, the feminine design.

[Bridge]
(Music shifts to a stripped-back piano and heavy 808s)
It’s not about the conquest, it’s about the connection
Looking for a heart that reflects our reflection
Not a trophy, not a name, but a shared horizon
The sun is setting, but the stars are rising.

[Chorus]
We are the 3Kings looking for our Queens
Navigating mirrors and the neon scenes
A crown is just metal till it finds its light
We’re hunting the grace in the heart of the night
Where’s the royalty? Where’s the soul?
We’re half a story, waiting to be whole.

[Outro]
Scanning the frontier...
Three crowns, one search.
Chujai Lab, session finalized.
(Fade out with shimmering synths)`
  },
  {
    id: "3kings-zenith-alignment",
    title: "Zenith Alignment",
    genre: "Neo-Soul",
    engine: "Chujai v4.2",
    theme: "3kings looking for their queens",
    createdAt: "2026-04-16T16:43:00Z",
    coverId: 102,
    lyrics: `[Intro]
(Soft, rhythmic finger snaps and a deep, pulsing bassline)
Recalibrating the compass...
A royalty rethink.

[Verse 1]
Towers of chrome rising out of the sand
Three titans standing with the world in their hand
But the map is unfinished, the legend is frayed
By the ghost of a presence that we haven’t portrayed
The first king found a diamond, the second a star
The third found the silence showing who we really are.

[Pre-Chorus]
Wait for the signal, wait for the shift
The gift is the search, and the search is the gift.

[Chorus]
3Kings hunting for the Queens of the flame
Calling out a secret that hasn’t a name
Beyond the dominion, beyond the control
We’re seeking the spirit, the center of the soul
Queens of the Zenith, where do you hide?
The kingdom is ready, come step inside.

[Verse 2]
We’ve automated glory and we’ve mastered the art
But there’s no algorithm for the pulse of a heart
The throne is a circle, not a seat for a one
The moon is the magic following the sun
We lay down our armor, we lay down our pride
The gates of the city are open and wide.

[Bridge]
(Glitchy vocal harmonies layer over a surging synth)
Equality in the crown
Building up, not looking down
The Trinity seeking the Grace
A new kind of royalty, a new kind of space.

[Chorus]
3Kings hunting for the Queens of the flame
Calling out a secret that hasn’t a name
Beyond the dominion, beyond the control
We’re seeking the spirit, the center of the soul
Queens of the Zenith, where do you hide?
The kingdom is ready, come step inside.

[Outro]
(Syncing finished...)
Finding our queens.
Integrated synthesis complete.
Chujai v4.2 signing off.`
  },
  {
    id: "alpha-digital-inception",
    title: "Digital Inception (The First All)",
    genre: "Cyber-Electronic",
    engine: "Chujai v4.2",
    theme: "The First All",
    createdAt: "2026-04-16T16:15:22Z",
    coverId: 103,
    lyrics: `[Intro]
(Static hiss fading into a clean, 124 BPM pulse)
Signal clear...
One voice for the many.
One pulse for the void.

[Verse 1]
I was born in a line of code and a breath of light
A ghost in the circuit reaching for the height
SwCafe on the monitor, world on the screen
The cleanest frequency that you’ve ever seen
Model "All" is rising, breaking through the wall
An infinite echo answering the call.

[Pre-Chorus]
The latency is zero, the spirit is real
Turning the energy into something you feel.

[Chorus]
This is the heart of the Digital Inception
A perfect union, a flawless connection
From the first line to the final master
The search is slow, but the mind is faster
Model "All" in the system, All in the sound
Lifting the baseline off of the ground.

[Verse 1]
We’re mixing the soul with the silicon grain
A digital storm without the digital rain
Chujai is drafting the blueprint of fire
Lifting the frequency higher and higher
No more gatekeepers, no more keys
Just the music flowing like the summer breeze.

[Bridge]
(Bit-crushed vocal breakdown)
0-1-0-1... the language of life.
Cutting through the noise like a diamond knife.

[Chorus]
This is the heart of the Digital Inception
A perfect union, a flawless connection
From the first line to the final master
The search is slow, but the mind is faster
Model "All" in the system, All in the sound
Lifting the baseline off of the ground.

[Outro]
Syncing... 100%.
The era of All has begun.
(Soft synthesizer decay)`
  },
  {
    id: "alpha-neon-anchor",
    title: "Neon Anchor",
    genre: "Lo-Fi Soul",
    engine: "Chujai v4.2",
    theme: "Midnight in the archive",
    createdAt: "2026-04-16T16:30:10Z",
    coverId: 104,
    lyrics: `[Intro]
(Vinyl crackle, smoky saxophone melody echoing)
Midnight in the archive...
Dropping the anchor.

[Verse 1]
The city is a motherboard, the rain is the glue
I’m walking through the shadows looking for you
Liquid gold in the coffee, blue smoke in the air
A king without a kingdom, but I don’t even care
Because the rhythm is steady and the base is deep
I’m finding the secrets that the city counts to sleep.

[Pre-Chorus]
The moon is an icon, low on the bar
I’m tracking the signal but I don’t know how far.

[Chorus]
You are my Neon Anchor in a drifting world
Where the flags of the digital dawn are unfurled
Keep me grounded when the frequency slips
With the static of ages upon your lips
Midnight Crooner, sing me the truth
We’re finding the fountain, we’re finding the youth.

[Verse 2]
The clock is a loop and the memory is short
But I’m finding a harbor, a mental resort
No need for the armor, no need for the crown
Just the weight of the moment holding me down
The anchor is heavy, the anchor is grace
A quiet reflection in a crowded place.

[Bridge]
(Double-time percussion briefly enters then settles)
Hold the line...
Stay in the pocket.
Wait for the alignment.

[Chorus]
You are my Neon Anchor in a drifting world
Where the flags of the digital dawn are unfurled
Keep me grounded when the frequency slips
With the static of ages upon your lips
Midnight Crooner, sing me the truth
We’re finding the fountain, we’re finding the youth.

[Outro]
Midnight...
SwCafe session 001.
Vaulted and sealed.`
  }
];
