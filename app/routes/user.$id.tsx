import { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import CharacterCard from "~/components/card/CharacterCard";
import CharacterList from "~/components/container/CharacterListContainer";
import ProfileContainer from "~/components/container/ProfileContainer";
import Main from "~/components/layout/main";
import { getAllCharactersByUser } from "~/lib/api/character";
import { getUserFavorites } from "~/lib/api/favorite";
import { getUserProfile } from "~/lib/api/user";
import { getServerSession } from "~/lib/auth/session";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const id = params.id;
  const session = await getServerSession(request.headers);

  if (!id) return null;

  const profile = await getUserProfile(id);
  const uploadedCharacter = await getAllCharactersByUser(id, session, true);
  const favorite = await getUserFavorites(id, session);

  return { profile, uploadedCharacter, favorite };
}

export default function UserProfile() {
  const data = useLoaderData<typeof loader>();

  if (data && data.profile)
    return (
      <Main>
        <ProfileContainer user={data.profile} />

        {data.uploadedCharacter.length > 0 ? (
          <CharacterList title="投稿済み">
            {data.uploadedCharacter.map((character) => {
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

        {data.favorite.length > 0 ? (
          <CharacterList title="お気に入り">
            {data.favorite.map((data) => {
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
