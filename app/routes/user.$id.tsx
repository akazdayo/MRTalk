import { LoaderFunctionArgs } from "@remix-run/node";
import { redirect, useLoaderData } from "@remix-run/react";
import CharacterCard from "~/components/card/CharacterCard";
import CharacterList from "~/components/container/CharacterListContainer";
import ProfileContainer from "~/components/container/ProfileContainer";
import Main from "~/components/layout/main";
import { getAllCharactersByUser } from "~/lib/api/character";
import { getUserFavorites } from "~/lib/api/favorite";
import { getUserProfile } from "~/lib/api/user";

export async function loader({ params }: LoaderFunctionArgs) {
  const id = params.id;

  if (!id) return redirect("/");

  const profile = await getUserProfile(id);
  const uploadedCharacter = await getAllCharactersByUser(id);
  const favorite = await getUserFavorites(id);

  return { profile, uploadedCharacter, favorite };
}

export default function UserProfile() {
  const { profile, uploadedCharacter, favorite } =
    useLoaderData<typeof loader>();

  if (profile)
    return (
      <Main>
        <ProfileContainer user={profile} />
        {uploadedCharacter.length > 0 ? (
          <CharacterList title="投稿済み">
            {uploadedCharacter.map((character) => {
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
        ) : (
          ""
        )}

        {favorite.length > 0 ? (
          <CharacterList title="お気に入り">
            {favorite.map((data) => {
              const character = data.character;

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
        ) : (
          ""
        )}
      </Main>
    );

  return <Main>ユーザーが見つかりませんでした。</Main>;
}
