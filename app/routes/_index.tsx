import { useLoaderData } from "@remix-run/react";
import CharacterCard from "~/components/card/CharacterCard";
import HomeContainer from "~/components/container/HomeContainer";
import Main from "~/components/layout/main";
import CharacterList from "~/components/container/CharacterListContainer";
import { getAllCharacters } from "~/lib/api/character";

export async function loader() {
  const characters = await getAllCharacters(true);

  return characters;
}

export default function Index() {
  const characters = useLoaderData<typeof loader>();
  return (
    <Main>
      <HomeContainer />

      <CharacterList title="最新のキャラクター">
        {characters.map((character) => {
          return (
            <CharacterCard
              key={character.id}
              id={character.id}
              name={character.name}
              postedby={character.user}
            />
          );
        })}
      </CharacterList>
    </Main>
  );
}
