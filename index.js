const { WebClient } = require('@slack/web-api')
const { exec } = require('child_process')

const web = new WebClient(process.env.ORG_TOKEN)

let users = {}
const ranks = [':one:', ':two:', ':three:', ':four:', ':five:']

const send = ({ allEmoji, emojisByUser, usersEmojiCount }) =>
  new Promise((resolve, reject) => {
    // Most used emoji
    // User that emojis the Most
    // That users favourite emojis
    const text = `
:fastparrot: Happy FriYAY! Emoji Of The Week Time :fastparrot:

Top 5 Emoji:
${allEmoji
  .slice(0, 5)
  .map(([emoji, count], index) => `${ranks[index]} :${emoji}: ${count}`)
  .join('\n')}

But who used them the most? :face_with_monocle:
${usersEmojiCount
  .slice(0, 5)
  .map(
    ([user, count], index) =>
      `${ranks[index]} ${
        users[user]
      } ${count}\n\t\t:arrow_right_hook: Their top 3: ${emojisByUser[user]
        .slice(0, 3)
        .map(([emoji, count]) => `:${emoji}: (${count})`)
        .join(' ')}`
  )
  .join('\n')}
`

    console.log(text)
    // return
    exec(
      `curl --silent -X POST -H 'Content-type: application/json' --data \'${JSON.stringify(
        {
          text
        }
      )}\' "${process.env.WEBHOOK_URL}"`,
      (error, stdout) => {
        console.log(error, stdout)
      }
    )
  })

;(async () => {
  for await (const page of web.paginate('users.list')) {
    // You can inspect each page, find your result, and stop the loop with a `break` statement
    page.members.forEach(
      ({ id, profile: { real_name } }) => (users[id] = real_name)
    )
  }

  let channels = []
  for await (const page of web.paginate('conversations.list', {
    exclude_archived: true
  })) {
    // You can inspect each page, find your result, and stop the loop with a `break` statement
    // console.log(page.channels[0])
    channels = channels.concat(
      page.channels
        .filter(({ num_members }) => num_members > 1)
        .map(({ id, name }) => ({
          id,
          name
        }))
    )
  }
  // console.log(channels.length)
  const jackTestChannel = channels.find(({ name }) => name === 'emoji')
  console.log(channels.filter(({ name }) => name === 'jack-test'))

  const usersEmojiCount = {}
  const emojisByUser = {}
  const allEmoji = {}

  const logEmoji = (user, name, count) => {
    if (!allEmoji[name]) allEmoji[name] = 0
    allEmoji[name] += count

    if (!usersEmojiCount[user]) usersEmojiCount[user] = 0
    usersEmojiCount[user]++

    if (!emojisByUser[user]) emojisByUser[user] = {}
    if (!emojisByUser[user][name]) emojisByUser[user][name] = 0
    emojisByUser[user][name]++
  }

  const messages = await web.conversations.history({
    channel: jackTestChannel.id,
    // limit: 1,
    inclusive: true,
    oldest: Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000)
  })
  // console.dir(messages, { depth: null, colors: true })

  messages.messages.forEach((message) => {
    message.reactions?.forEach((reaction) => {
      const emojiName = reaction.name.split('::')[0]
      reaction.users.forEach((user) => {
        logEmoji(user, emojiName, reaction.count)
      })
    })
    message.blocks?.forEach((block) => {
      block.elements?.forEach((element) => {
        element.elements?.forEach((subElement) => {
          // console.log({ subElement })
          if (subElement.type === 'emoji') {
            logEmoji(message.user, subElement.name, 1)
          }
        })
      })
    })
  })

  console.log(allEmoji)
  console.log(emojisByUser)
  console.log(usersEmojiCount)

  const sortedAllEmoji = Object.entries(allEmoji).sort(([, a], [, b]) => b - a)
  const sortedUsersEmojiCount = Object.entries(usersEmojiCount).sort(
    ([, a], [, b]) => b - a
  )
  const sortedEmojisByUser = Object.keys(emojisByUser).reduce(
    (acc, current) => ({
      [current]: Object.entries(emojisByUser[current]).sort(
        ([, a], [, b]) => b - a
      ),
      ...acc
    }),
    {}
  )
  await send({
    allEmoji: sortedAllEmoji,
    emojisByUser: sortedEmojisByUser,
    usersEmojiCount: sortedUsersEmojiCount
  })
})()
// console.log(web.client)
